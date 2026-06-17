/**
 * Maintenance role: periodic retention sweeps + outbound notifications.
 *
 * - Retention: when a user sets retention.days > 0, meetings older than the cutoff (and their
 *   transcripts/summaries/recordings rows, via cascade) are deleted.
 * - Notifications: when a meeting reaches `complete` and the user has a notifications.webhook_url,
 *   POST a compact summary payload once and record a notifications row (idempotent via that row).
 */
import { type Database, and, eq, isNull, lt, schema } from '@pmn/db';
import { Queue } from 'bullmq';
import { QUEUE, bullConnection } from './queues.js';

const TICK_INTERVAL_MS = Number(process.env.MAINTENANCE_INTERVAL_MS ?? `${60 * 60_000}`); // hourly

/** Retention cutoff date, or null when retention is disabled (days <= 0). Pure. */
export function retentionCutoff(now: Date, days: number): Date | null {
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(now.getTime() - days * 86_400_000);
}

export interface NotifyPayload {
  meetingId: string;
  title: string | null;
  status: string;
  startAt: string | null;
  summary: string | null;
  actionItems: string[];
}

/** Build the webhook payload for a completed meeting. Pure. */
export function buildNotifyPayload(
  meeting: { id: string; title: string | null; status: string; startAt: Date | null },
  summary: string | null,
  actionItems: string[],
): NotifyPayload {
  return {
    meetingId: meeting.id,
    title: meeting.title,
    status: meeting.status,
    startAt: meeting.startAt ? meeting.startAt.toISOString() : null,
    summary,
    actionItems,
  };
}

async function loadUserSettings(
  db: Database,
  userId: string,
): Promise<{ retentionDays: number; webhookUrl: string | null }> {
  const rows = await db
    .select({ key: schema.settings.key, value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.userId, userId));
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const webhook = map.get('notifications.webhook_url');
  return {
    retentionDays: Number(map.get('retention.days') ?? 0),
    webhookUrl: typeof webhook === 'string' && webhook.trim() ? webhook.trim() : null,
  };
}

/** Delete meetings older than the retention cutoff for one user. Returns rows deleted. */
export async function applyRetention(db: Database, userId: string, now: Date): Promise<number> {
  const { retentionDays } = await loadUserSettings(db, userId);
  const cutoff = retentionCutoff(now, retentionDays);
  if (!cutoff) return 0;
  const deleted = await db
    .delete(schema.meetings)
    .where(and(eq(schema.meetings.userId, userId), lt(schema.meetings.startAt, cutoff)))
    .returning({ id: schema.meetings.id });
  return deleted.length;
}

/** Send pending completion notifications for one user. Returns count attempted. */
export async function dispatchNotifications(
  db: Database,
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const { webhookUrl } = await loadUserSettings(db, userId);
  if (!webhookUrl) return 0;

  // Completed meetings with no notification row yet.
  const pending = await db
    .select({
      id: schema.meetings.id,
      title: schema.meetings.title,
      status: schema.meetings.status,
      startAt: schema.meetings.startAt,
    })
    .from(schema.meetings)
    .leftJoin(schema.notifications, eq(schema.notifications.meetingId, schema.meetings.id))
    .where(
      and(
        eq(schema.meetings.userId, userId),
        eq(schema.meetings.status, 'complete'),
        isNull(schema.notifications.id),
      ),
    )
    .limit(50);

  let attempted = 0;
  for (const meeting of pending) {
    const [summary] = await db
      .select({ summary: schema.summaries.summary })
      .from(schema.summaries)
      .where(eq(schema.summaries.meetingId, meeting.id))
      .limit(1);
    const items = await db
      .select({ text: schema.actionItems.text })
      .from(schema.actionItems)
      .where(eq(schema.actionItems.meetingId, meeting.id));
    const payload = buildNotifyPayload(
      meeting,
      summary?.summary ?? null,
      items.map((i) => i.text),
    );

    let ok = false;
    try {
      const res = await fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    attempted++;
    await db.insert(schema.notifications).values({
      meetingId: meeting.id,
      channel: 'webhook',
      payload: payload as unknown as Record<string, unknown>,
      status: ok ? 'sent' : 'failed',
      attempts: 1,
      sentAt: ok ? new Date() : null,
    });
  }
  return attempted;
}

/** One maintenance pass over all users. */
export async function runMaintenanceTick(db: Database): Promise<void> {
  const now = new Date();
  const users = await db.select({ id: schema.users.id }).from(schema.users);
  for (const user of users) {
    try {
      const purged = await applyRetention(db, user.id, now);
      const notified = await dispatchNotifications(db, user.id);
      if (purged || notified) {
        console.log(`[maintenance] user ${user.id}: purged ${purged}, notified ${notified}`);
      }
    } catch (err) {
      console.error(`[maintenance] failed for user ${user.id}:`, (err as Error).message);
    }
  }
}

/** Start the maintenance role: a repeatable hourly tick. */
export async function startMaintenance(deps: { db: Database }): Promise<{ queue: Queue }> {
  const conn = bullConnection();
  const queue = new Queue(QUEUE.maintenance, { connection: conn });
  const { Worker } = await import('bullmq');
  new Worker(
    QUEUE.maintenance,
    async () => {
      await runMaintenanceTick(deps.db);
    },
    { connection: conn, concurrency: 1 },
  );
  await queue.add('tick', {}, { repeat: { every: TICK_INTERVAL_MS }, jobId: 'maintenance-tick' });
  await queue.add('tick', {}, { jobId: 'maintenance-boot' });
  return { queue };
}
