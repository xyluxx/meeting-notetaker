/**
 * Scheduler role: ingest calendar sources (iCal/ICS feeds + CalDAV collections) into `meetings`, and
 * enqueue delayed Vexa dispatch jobs for upcoming auto-join meetings.
 *
 * Sources are modeled as connected_accounts (provider 'ics' | 'caldav') each with one calendars row.
 * For ICS the feed URL lives in caldav_base_url; for CalDAV it's the collection URL + Basic creds.
 * The pure planner (planMeetingsFromEvents) is unit-tested; the rest is DB/HTTP orchestration.
 */
import { type Database, and, eq, gte, inArray, lte, schema } from '@pmn/db';
import {
  type AutoJoinRules,
  type VEvent,
  buildCalendarQueryReport,
  decryptSecret,
  evaluateAutoJoin,
  expandOccurrences,
  extractEventMeeting,
  parseICalendar,
  parseMultiStatus,
} from '@pmn/shared';
import { Queue } from 'bullmq';
import { QUEUE, bullConnection } from './queues.js';

/** How far ahead we materialize occurrences + look for joins. */
const HORIZON_DAYS = Number(process.env.CALENDAR_HORIZON_DAYS ?? '14');
const SYNC_INTERVAL_MS = Number(process.env.CALENDAR_SYNC_INTERVAL_MS ?? `${15 * 60_000}`);
const DEFAULT_LEAD_SECONDS = 60;

export interface PlannedMeeting {
  externalEventId: string;
  externalIcalUid: string;
  title: string | null;
  startAt: Date;
  endAt: Date | null;
  meetUrl: string;
  organizerEmail: string | null;
  attendees: string[];
  autoJoin: boolean;
  autoJoinReason: string;
}

/**
 * Pure: turn parsed VEVENTs into the set of meetings to upsert for one calendar, within
 * [windowStart, windowEnd], applying the auto-join rule engine. Events without a recognized join URL
 * are dropped. Recurring events fan out to one planned meeting per occurrence.
 */
export function planMeetingsFromEvents(
  events: VEvent[],
  windowStart: Date,
  windowEnd: Date,
  rules: AutoJoinRules,
  calendarDefault: boolean | null,
): PlannedMeeting[] {
  const out: PlannedMeeting[] = [];
  for (const event of events) {
    if (event.status === 'CANCELLED') continue;
    const meeting = extractEventMeeting(event);
    if (!meeting) continue;
    const occurrences = expandOccurrences(event, windowStart, windowEnd);
    const durationMs =
      event.start && event.end ? event.end.getTime() - event.start.getTime() : null;
    for (const start of occurrences) {
      const decision = evaluateAutoJoin(rules, {
        calendarDefault,
        organizerEmail: event.organizerEmail,
        attendeeEmails: event.attendeeEmails,
        title: event.summary,
        hasMeetUrl: true,
      });
      const isRecurring = Boolean(event.rrule);
      out.push({
        externalEventId: isRecurring ? `${event.uid}::${start.toISOString()}` : event.uid,
        externalIcalUid: event.uid,
        title: event.summary,
        startAt: start,
        endAt: durationMs !== null ? new Date(start.getTime() + durationMs) : null,
        meetUrl: meeting.url,
        organizerEmail: event.organizerEmail,
        attendees: event.attendeeEmails,
        autoJoin: decision.join,
        autoJoinReason: decision.reason,
      });
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Settings (read directly from the table; worker has no server-only lib)      */
/* -------------------------------------------------------------------------- */

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export async function loadAutoJoinRules(
  db: Database,
  userId: string,
): Promise<{ rules: AutoJoinRules; leadSeconds: number }> {
  const rows = await db
    .select({ key: schema.settings.key, value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.userId, userId));
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    rules: {
      globalEnabled: map.get('auto_join.global_enabled') === true,
      skipTitleKeywords: asStringArray(map.get('auto_join.skip_title_keywords')),
      allowDomains: asStringArray(map.get('auto_join.allow_domains')),
      denyDomains: asStringArray(map.get('auto_join.deny_domains')),
    },
    leadSeconds: Number(map.get('auto_join.lead_seconds') ?? DEFAULT_LEAD_SECONDS),
  };
}

/* -------------------------------------------------------------------------- */
/* Source fetching                                                             */
/* -------------------------------------------------------------------------- */

async function fetchIcs(url: string): Promise<VEvent[]> {
  const res = await fetch(url, { headers: { Accept: 'text/calendar, */*' } });
  if (!res.ok) throw new Error(`ICS fetch ${res.status} for ${url}`);
  return parseICalendar(await res.text());
}

async function fetchCalDav(
  url: string,
  username: string,
  password: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<VEvent[]> {
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  const res = await fetch(url, {
    method: 'REPORT',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/xml; charset=utf-8',
      Depth: '1',
    },
    body: buildCalendarQueryReport(windowStart, windowEnd),
  });
  if (!res.ok) throw new Error(`CalDAV REPORT ${res.status} for ${url}`);
  const objects = parseMultiStatus(await res.text());
  return objects.flatMap((o) => (o.calendarData ? parseICalendar(o.calendarData) : []));
}

/* -------------------------------------------------------------------------- */
/* Sync orchestration                                                          */
/* -------------------------------------------------------------------------- */

interface SourceRow {
  accountId: string;
  userId: string;
  provider: string;
  url: string | null;
  username: string | null;
  passwordEnc: string | null;
  calendarId: string;
  autoJoinDefault: boolean | null;
}

async function loadEnabledSources(db: Database): Promise<SourceRow[]> {
  const rows = await db
    .select({
      accountId: schema.connectedAccounts.id,
      userId: schema.connectedAccounts.userId,
      provider: schema.connectedAccounts.provider,
      url: schema.connectedAccounts.caldavBaseUrl,
      username: schema.connectedAccounts.caldavUsername,
      passwordEnc: schema.connectedAccounts.caldavPasswordEnc,
      calendarId: schema.calendars.id,
      autoJoinDefault: schema.calendars.autoJoinDefault,
    })
    .from(schema.connectedAccounts)
    .innerJoin(
      schema.calendars,
      eq(schema.calendars.connectedAccountId, schema.connectedAccounts.id),
    )
    .where(
      and(
        inArray(schema.connectedAccounts.provider, ['ics', 'caldav']),
        eq(schema.connectedAccounts.status, 'active'),
        eq(schema.calendars.syncEnabled, true),
      ),
    );
  return rows;
}

/** Sync one source: fetch + parse + upsert meetings. Returns the number of meetings upserted. */
export async function syncSource(db: Database, source: SourceRow): Promise<number> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);
  const { rules } = await loadAutoJoinRules(db, source.userId);

  let events: VEvent[];
  if (source.provider === 'ics') {
    if (!source.url) return 0;
    events = await fetchIcs(source.url);
  } else {
    const key = process.env.APP_ENCRYPTION_KEY;
    if (!source.url || !source.username || !source.passwordEnc || !key) return 0;
    const password = decryptSecret(source.passwordEnc, key);
    events = await fetchCalDav(source.url, source.username, password, now, windowEnd);
  }

  const planned = planMeetingsFromEvents(events, now, windowEnd, rules, source.autoJoinDefault);
  const meetingSource = source.provider === 'ics' ? 'ics' : 'caldav';

  for (const m of planned) {
    await db
      .insert(schema.meetings)
      .values({
        userId: source.userId,
        calendarId: source.calendarId,
        source: meetingSource,
        externalEventId: m.externalEventId,
        externalIcalUid: m.externalIcalUid,
        title: m.title,
        meetUrl: m.meetUrl,
        meetUrlSource: 'regex',
        organizerEmail: m.organizerEmail,
        attendees: m.attendees,
        startAt: m.startAt,
        endAt: m.endAt,
        status: 'scheduled',
        autoJoin: m.autoJoin,
        autoJoinReason: m.autoJoinReason,
      })
      .onConflictDoUpdate({
        target: [schema.meetings.calendarId, schema.meetings.externalEventId],
        // Refresh details only; never clobber the lifecycle status of an in-flight/finished meeting.
        set: {
          title: m.title,
          meetUrl: m.meetUrl,
          startAt: m.startAt,
          endAt: m.endAt,
          organizerEmail: m.organizerEmail,
          attendees: m.attendees,
          autoJoin: m.autoJoin,
          autoJoinReason: m.autoJoinReason,
          updatedAt: new Date(),
        },
      });
  }

  await db
    .insert(schema.calendarSyncState)
    .values({ calendarId: source.calendarId, lastFullSyncAt: now, syncStatus: 'ok' })
    .onConflictDoUpdate({
      target: schema.calendarSyncState.calendarId,
      set: { lastFullSyncAt: now, syncStatus: 'ok', errorDetail: null, updatedAt: new Date() },
    });

  return planned.length;
}

/** Enqueue delayed Vexa dispatch jobs for auto-join meetings whose join time is within reach. */
export async function scheduleUpcomingJoins(db: Database, meetingsQueue: Queue): Promise<number> {
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);
  const due = await db
    .select({
      id: schema.meetings.id,
      userId: schema.meetings.userId,
      startAt: schema.meetings.startAt,
    })
    .from(schema.meetings)
    .where(
      and(
        eq(schema.meetings.autoJoin, true),
        eq(schema.meetings.status, 'scheduled'),
        gte(schema.meetings.startAt, now),
        lte(schema.meetings.startAt, horizon),
      ),
    );

  const leadByUser = new Map<string, number>();
  let scheduled = 0;
  for (const m of due) {
    if (!m.startAt) continue;
    if (!leadByUser.has(m.userId)) {
      leadByUser.set(m.userId, (await loadAutoJoinRules(db, m.userId)).leadSeconds);
    }
    const lead = leadByUser.get(m.userId)!;
    const delay = Math.max(0, m.startAt.getTime() - lead * 1000 - now.getTime());
    // jobId dedups across re-syncs; BullMQ ignores a duplicate add.
    await meetingsQueue.add('dispatch', { meetingId: m.id }, { jobId: `meeting:${m.id}`, delay });
    scheduled++;
  }
  return scheduled;
}

/** One scheduler tick: sync all sources, then schedule upcoming joins. */
export async function runSchedulerTick(db: Database, meetingsQueue: Queue): Promise<void> {
  const sources = await loadEnabledSources(db);
  for (const source of sources) {
    try {
      const n = await syncSource(db, source);
      console.log(
        `[scheduler] synced ${source.provider} calendar ${source.calendarId}: ${n} meetings`,
      );
    } catch (err) {
      console.error(
        `[scheduler] sync failed for calendar ${source.calendarId}:`,
        (err as Error).message,
      );
      await db
        .insert(schema.calendarSyncState)
        .values({
          calendarId: source.calendarId,
          syncStatus: 'error',
          errorDetail: (err as Error).message,
        })
        .onConflictDoUpdate({
          target: schema.calendarSyncState.calendarId,
          set: { syncStatus: 'error', errorDetail: (err as Error).message, updatedAt: new Date() },
        });
    }
  }
  const scheduled = await scheduleUpcomingJoins(db, meetingsQueue);
  console.log(`[scheduler] scheduled ${scheduled} upcoming join(s)`);
}

/** Start the scheduler: a repeatable tick that syncs sources + schedules joins. */
export async function startScheduler(deps: { db: Database }): Promise<{ syncQueue: Queue }> {
  const conn = bullConnection();
  const syncQueue = new Queue(QUEUE.calendarSync, { connection: conn });
  const meetingsQueue = new Queue(QUEUE.meetings, { connection: conn });

  const { Worker } = await import('bullmq');
  new Worker(
    QUEUE.calendarSync,
    async () => {
      await runSchedulerTick(deps.db, meetingsQueue);
    },
    { connection: conn, concurrency: 1 },
  );

  // Repeatable tick. A fixed jobId keeps a single schedule across restarts.
  await syncQueue.add(
    'tick',
    {},
    { repeat: { every: SYNC_INTERVAL_MS }, jobId: 'calendar-sync-tick' },
  );
  // Kick one immediately on boot.
  await syncQueue.add('tick', {}, { jobId: `calendar-sync-boot` });

  return { syncQueue };
}
