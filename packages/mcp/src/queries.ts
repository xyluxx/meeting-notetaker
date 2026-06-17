import { type Database, and, asc, desc, eq, ilike, or, schema } from '@pmn/db';
import type {
  ListActionItemsOpts,
  MeetingQueries,
  SearchMeetingsOpts,
  TranscriptSegmentRow,
} from './types';

/** Drizzle-backed {@link MeetingQueries}. Every method filters by `userId`. */
export function createDbQueries(db: Database): MeetingQueries {
  return {
    async searchMeetings(userId, opts: SearchMeetingsOpts) {
      const filters = [eq(schema.meetings.userId, userId)];
      if (opts.status) filters.push(eq(schema.meetings.status, opts.status as never));
      if (opts.query) {
        const pattern = `%${opts.query}%`;
        const text = or(
          ilike(schema.meetings.title, pattern),
          ilike(schema.meetings.description, pattern),
        );
        if (text) filters.push(text);
      }
      return db
        .select()
        .from(schema.meetings)
        .where(and(...filters))
        .orderBy(desc(schema.meetings.startAt), desc(schema.meetings.createdAt))
        .limit(opts.limit);
    },

    async getMeeting(userId, meetingId) {
      const [row] = await db
        .select()
        .from(schema.meetings)
        .where(and(eq(schema.meetings.id, meetingId), eq(schema.meetings.userId, userId)))
        .limit(1);
      return row ?? null;
    },

    async getTranscript(userId, meetingId) {
      const [meeting] = await db
        .select({ id: schema.meetings.id })
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
      if (!transcript) return null;

      const segments: TranscriptSegmentRow[] = await db
        .select()
        .from(schema.transcriptSegments)
        .where(eq(schema.transcriptSegments.transcriptId, transcript.id))
        .orderBy(asc(schema.transcriptSegments.idx));
      return { transcript, segments };
    },

    async getSummary(userId, meetingId) {
      const [meeting] = await db
        .select({ id: schema.meetings.id })
        .from(schema.meetings)
        .where(and(eq(schema.meetings.id, meetingId), eq(schema.meetings.userId, userId)))
        .limit(1);
      if (!meeting) return null;

      const [summary] = await db
        .select()
        .from(schema.summaries)
        .where(eq(schema.summaries.meetingId, meetingId))
        .orderBy(desc(schema.summaries.createdAt))
        .limit(1);
      return summary ?? null;
    },

    async listActionItems(userId, opts: ListActionItemsOpts) {
      const filters = [eq(schema.meetings.userId, userId)];
      if (opts.meetingId) filters.push(eq(schema.actionItems.meetingId, opts.meetingId));
      if (typeof opts.done === 'boolean') filters.push(eq(schema.actionItems.done, opts.done));
      const rows = await db
        .select()
        .from(schema.actionItems)
        .innerJoin(schema.meetings, eq(schema.actionItems.meetingId, schema.meetings.id))
        .where(and(...filters))
        .orderBy(desc(schema.actionItems.updatedAt))
        .limit(opts.limit);
      return rows.map((r) => r.action_items);
    },

    async updateActionItem(userId, actionItemId, done) {
      const [row] = await db
        .select({ id: schema.actionItems.id })
        .from(schema.actionItems)
        .innerJoin(schema.meetings, eq(schema.actionItems.meetingId, schema.meetings.id))
        .where(and(eq(schema.actionItems.id, actionItemId), eq(schema.meetings.userId, userId)))
        .limit(1);
      if (!row) return false;
      await db
        .update(schema.actionItems)
        .set({ done })
        .where(eq(schema.actionItems.id, actionItemId));
      return true;
    },
  };
}
