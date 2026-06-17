import 'server-only';
import { and, asc, count, desc, eq, ilike, or, schema } from '@pmn/db';
import { MEETING_STATUSES, parseMeetingUrl } from '@pmn/shared';
import { db } from './db';
import { meetingsQueue } from './queue';

export interface CreateMeetingInput {
  rawLink: string;
  title?: string;
  startAt?: Date | null;
  endAt?: Date | null;
}

/** Create a meeting from a pasted Meet/Teams/Zoom link. Throws if the link isn't recognized. */
export async function createMeeting(userId: string, input: CreateMeetingInput): Promise<string> {
  const parsed = parseMeetingUrl(input.rawLink);
  if (!parsed) {
    throw new Error('Not a recognized Google Meet, Teams, or Zoom link.');
  }
  const [row] = await db
    .insert(schema.meetings)
    .values({
      userId,
      source: 'manual',
      meetUrl: parsed.url,
      meetUrlSource: 'manual',
      title: input.title?.trim() || `${platformLabel(parsed.platform)} meeting`,
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      status: 'scheduled',
    })
    .returning({ id: schema.meetings.id });
  return row!.id;
}

function platformLabel(p: string): string {
  return p === 'google_meet'
    ? 'Google Meet'
    : p === 'teams'
      ? 'Teams'
      : p === 'zoom'
        ? 'Zoom'
        : 'Meeting';
}

export interface ListMeetingsOpts {
  query?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

function meetingFilters(userId: string, opts: ListMeetingsOpts) {
  const filters = [eq(schema.meetings.userId, userId)];
  // Only filter on a recognized status — an arbitrary string would be an invalid enum value and
  // make Postgres reject the whole query.
  if (opts.status && (MEETING_STATUSES as readonly string[]).includes(opts.status)) {
    filters.push(eq(schema.meetings.status, opts.status as (typeof MEETING_STATUSES)[number]));
  }
  if (opts.query?.trim()) {
    const pattern = `%${opts.query.trim()}%`;
    const text = or(
      ilike(schema.meetings.title, pattern),
      ilike(schema.meetings.description, pattern),
    );
    if (text) filters.push(text);
  }
  return and(...filters);
}

/** Paginated, optionally searched/filtered list of the owner's meetings (most recent first). */
export async function listMeetings(userId: string, opts: ListMeetingsOpts = {}) {
  return db
    .select()
    .from(schema.meetings)
    .where(meetingFilters(userId, opts))
    .orderBy(desc(schema.meetings.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

/** Total meetings matching the same filters — for pagination. */
export async function countMeetings(userId: string, opts: ListMeetingsOpts = {}): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.meetings)
    .where(meetingFilters(userId, opts));
  return Number(row?.n ?? 0);
}

/** Count the owner's open (not-done) action items across all meetings. */
export async function countOpenActionItems(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.actionItems)
    .innerJoin(schema.meetings, eq(schema.actionItems.meetingId, schema.meetings.id))
    .where(and(eq(schema.meetings.userId, userId), eq(schema.actionItems.done, false)));
  return Number(row?.n ?? 0);
}

/** Meeting + latest transcript (with segments) + latest summary + action items. */
export async function getMeetingDetail(userId: string, meetingId: string) {
  const [meeting] = await db
    .select()
    .from(schema.meetings)
    .where(and(eq(schema.meetings.id, meetingId), eq(schema.meetings.userId, userId)))
    .limit(1);
  if (!meeting) return null;

  const [transcript] = await db
    .select()
    .from(schema.transcripts)
    .where(eq(schema.transcripts.meetingId, meetingId))
    .orderBy(desc(schema.transcripts.createdAt))
    .limit(1);

  const segments = transcript
    ? await db
        .select()
        .from(schema.transcriptSegments)
        .where(eq(schema.transcriptSegments.transcriptId, transcript.id))
        .orderBy(asc(schema.transcriptSegments.idx))
    : [];

  const [summary] = await db
    .select()
    .from(schema.summaries)
    .where(eq(schema.summaries.meetingId, meetingId))
    .orderBy(desc(schema.summaries.createdAt))
    .limit(1);

  const actionItems = await db
    .select()
    .from(schema.actionItems)
    .where(eq(schema.actionItems.meetingId, meetingId))
    .orderBy(asc(schema.actionItems.orderIdx));

  return {
    meeting,
    transcript: transcript ?? null,
    segments,
    summary: summary ?? null,
    actionItems,
  };
}

/** Enqueue a dispatch job for the worker's vexa-driver to send a bot. Verifies ownership. */
export async function dispatchMeeting(userId: string, meetingId: string): Promise<void> {
  const [meeting] = await db
    .select({ id: schema.meetings.id })
    .from(schema.meetings)
    .where(and(eq(schema.meetings.id, meetingId), eq(schema.meetings.userId, userId)))
    .limit(1);
  if (!meeting) throw new Error('Meeting not found');
  await db
    .update(schema.meetings)
    .set({ status: 'scheduled' })
    .where(eq(schema.meetings.id, meetingId));
  const queue = meetingsQueue();
  // No ':' — BullMQ rejects custom job IDs containing a colon.
  const jobId = `meeting-${meetingId}`;
  // Remove any prior completed/failed/stuck job first: BullMQ ignores an add() that reuses an
  // existing jobId, so without this a meeting could only ever be dispatched once. removeOn* also
  // keeps the queue from accumulating finished jobs that would block the next dispatch.
  await queue.remove(jobId).catch(() => undefined);
  await queue.add('dispatch', { meetingId }, { jobId, removeOnComplete: true, removeOnFail: true });
}

/** Toggle an action item done/undone, verifying it belongs to the owner. */
export async function toggleActionItem(
  userId: string,
  actionItemId: string,
  done: boolean,
): Promise<void> {
  const [row] = await db
    .select({ id: schema.actionItems.id })
    .from(schema.actionItems)
    .innerJoin(schema.meetings, eq(schema.actionItems.meetingId, schema.meetings.id))
    .where(and(eq(schema.actionItems.id, actionItemId), eq(schema.meetings.userId, userId)))
    .limit(1);
  if (!row) throw new Error('Action item not found');
  await db.update(schema.actionItems).set({ done }).where(eq(schema.actionItems.id, actionItemId));
}
