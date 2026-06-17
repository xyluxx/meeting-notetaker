/**
 * vexa-driver worker role: consumes the `meetings` dispatch queue and drives Vexa over REST.
 * On a {meetingId} job it loads the meeting, asks Vexa to send a bot (POST /bots via VexaClient),
 * mirrors the returned Vexa bot id into a bot_sessions row, and advances the meeting status —
 * publishing the transition to the existing Redis status channel so the dashboard SSE updates.
 *
 * We do NOT spawn containers ourselves (no Docker socket) — Vexa owns the bot.
 */
import { type Database, eq, schema } from '@pmn/db';
import {
  type VexaCreateBotInput,
  VexaClient,
  type VexaPlatform,
  meetUrlToNativeId,
} from '@pmn/shared';
import { type Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import {
  QUEUE,
  bullConnection,
  bullConnectionOptions,
  meetingStatusChannel,
  redisUrl,
} from './queues.js';
import { vexaConfig } from './vexa-config.js';

export interface DispatchJobData {
  meetingId: string;
}

/**
 * Pure: map a meeting row to a Vexa create-bot request. Returns null when there's no usable
 * join URL. Currently derives the Google Meet code from `meetUrl`; Teams/Zoom URL parsing is
 * added alongside their ingestion (the meeting model already carries `meetUrl`).
 */
export function planDispatch(
  meeting: { meetUrl: string | null; source: string },
  opts: { botName: string; language?: string },
): VexaCreateBotInput | null {
  const code = meetUrlToNativeId(meeting.meetUrl);
  if (!code) return null;
  const platform: VexaPlatform = 'google_meet';
  return {
    platform,
    nativeMeetingId: code,
    botName: opts.botName,
    ...(opts.language ? { language: opts.language } : {}),
    recordingEnabled: true,
    transcribeEnabled: true,
  };
}

export interface DispatchDeps {
  db: Database;
  vexa: VexaClient;
  botName: string;
  publish: (channel: string, payload: string) => void;
  language?: string;
}

/** Load a meeting, request a Vexa bot for it, and record the bot session + status transition. */
export async function dispatchMeeting(deps: DispatchDeps, meetingId: string): Promise<void> {
  const { db, vexa, publish } = deps;

  const [meeting] = await db
    .select()
    .from(schema.meetings)
    .where(eq(schema.meetings.id, meetingId))
    .limit(1);
  if (!meeting) throw new Error(`dispatchMeeting: meeting ${meetingId} not found`);

  // Idempotency: don't re-dispatch a meeting already past 'scheduled'/'dispatching'.
  if (!['scheduled', 'dispatching'].includes(meeting.status)) {
    return;
  }

  const plan = planDispatch(meeting, { botName: deps.botName, language: deps.language });
  if (!plan) {
    await db
      .update(schema.meetings)
      .set({ status: 'failed_join', autoJoinReason: 'no usable meet URL' })
      .where(eq(schema.meetings.id, meetingId));
    publish(meetingStatusChannel(meetingId), JSON.stringify({ status: 'failed_join' }));
    return;
  }

  await db
    .update(schema.meetings)
    .set({ status: 'dispatching' })
    .where(eq(schema.meetings.id, meetingId));

  const vexaMeeting = await vexa.createBot(plan);

  await db.insert(schema.botSessions).values({
    meetingId,
    state: 'requested',
    // Mirror Vexa's integer bot id (its handle for this bot) into containerId.
    containerId: String(vexaMeeting.id),
    displayName: plan.botName,
  });

  await db
    .update(schema.meetings)
    .set({ status: 'joining' })
    .where(eq(schema.meetings.id, meetingId));
  publish(
    meetingStatusChannel(meetingId),
    JSON.stringify({ status: 'joining', vexaId: vexaMeeting.id }),
  );
}

/** Start the BullMQ worker for the `meetings` dispatch queue. Concurrency caps simultaneous bots. */
export function startVexaDriver(deps: { db: Database }): Worker<DispatchJobData> {
  // Our own pub client for status fan-out (ioredis instance is fine — not handed to BullMQ).
  const pub = new Redis(redisUrl(), bullConnectionOptions);
  const cfg = vexaConfig();
  const vexa = new VexaClient({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey });

  const concurrency = Number(process.env.MAX_CONCURRENT_BOTS ?? '1');
  const worker = new Worker<DispatchJobData>(
    QUEUE.meetings,
    async (job: Job<DispatchJobData>) => {
      await dispatchMeeting(
        {
          db: deps.db,
          vexa,
          botName: cfg.botNameDefault,
          publish: (channel, payload) => void pub.publish(channel, payload),
        },
        job.data.meetingId,
      );
    },
    { connection: bullConnection(), concurrency },
  );

  worker.on('failed', (job, err) =>
    console.error(`[vexa-driver] job ${job?.id} failed:`, err.message),
  );
  return worker;
}
