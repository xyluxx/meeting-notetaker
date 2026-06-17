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
  type MeetingStatus,
  type VexaCreateBotInput,
  VexaClient,
  type VexaPlatform,
  parseMeetingUrl,
} from '@pmn/shared';
import { type Job, Queue, Worker } from 'bullmq';
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
 * Pure: map a meeting row to a Vexa create-bot request. Returns null when the meetUrl isn't a
 * recognized meeting link. Handles Google Meet, Teams (live + enterprise), and Zoom via parseMeetingUrl.
 */
export function planDispatch(
  meeting: { meetUrl: string | null; source: string },
  opts: { botName: string; language?: string },
): VexaCreateBotInput | null {
  const parsed = parseMeetingUrl(meeting.meetUrl);
  if (!parsed) return null;
  return {
    platform: parsed.platform,
    nativeMeetingId: parsed.nativeMeetingId,
    ...(parsed.passcode ? { passcode: parsed.passcode } : {}),
    ...(parsed.teamsBaseHost ? { teamsBaseHost: parsed.teamsBaseHost } : {}),
    botName: opts.botName,
    ...(opts.language ? { language: opts.language } : {}),
    recordingEnabled: true,
    transcribeEnabled: true,
  };
}

export interface PollJobData {
  meetingId: string;
  platform: VexaPlatform;
  nativeMeetingId: string;
  attempt: number;
}

export interface DispatchDeps {
  db: Database;
  vexa: VexaClient;
  botName: string;
  publish: (channel: string, payload: string) => void;
  /** Schedule the first status poll for the dispatched bot. */
  enqueuePoll: (data: PollJobData, delayMs: number) => Promise<void>;
  language?: string;
}

/** Our meeting status that a Vexa lifecycle state maps to (null = no change yet). */
export function mapVexaStatus(
  vexaStatus: string,
): { status: MeetingStatus; terminal: boolean; completed: boolean } | null {
  switch (vexaStatus) {
    case 'requested':
    case 'joining':
      return { status: 'joining', terminal: false, completed: false };
    case 'awaiting_admission':
      return { status: 'waiting_lobby', terminal: false, completed: false };
    case 'active':
      return { status: 'recording', terminal: false, completed: false };
    case 'stopping':
      return { status: 'processing', terminal: false, completed: false };
    case 'completed':
      return { status: 'processing', terminal: true, completed: true };
    case 'failed':
      return { status: 'failed_recording', terminal: true, completed: false };
    default:
      return null;
  }
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

  // Start polling Vexa for this meeting's lifecycle until it completes/fails.
  await deps.enqueuePoll(
    { meetingId, platform: plan.platform, nativeMeetingId: plan.nativeMeetingId, attempt: 0 },
    15_000,
  );
}

const POLL_INTERVAL_MS = 15_000;
const POLL_MAX_ATTEMPTS = Number(process.env.VEXA_POLL_MAX_ATTEMPTS ?? '960'); // ~4h at 15s

export interface PollDeps {
  db: Database;
  vexa: VexaClient;
  publish: (channel: string, payload: string) => void;
  enqueueTranscription: (data: {
    meetingId: string;
    platform: VexaPlatform;
    nativeMeetingId: string;
  }) => Promise<void>;
  enqueuePoll: (data: PollJobData, delayMs: number) => Promise<void>;
}

/**
 * Poll Vexa for a meeting's status. Advances our status as the bot joins/records; on `completed`
 * enqueues transcript ingest; on `failed` marks failed; otherwise re-schedules itself. This is the
 * completion trigger that drives the post-call pipeline (no inbound webhook needed on a single box).
 */
export async function pollMeeting(deps: PollDeps, data: PollJobData): Promise<void> {
  const { db, vexa, publish, enqueueTranscription, enqueuePoll } = deps;

  let vexaStatus: string;
  try {
    const t = await vexa.getTranscript(data.platform, data.nativeMeetingId);
    vexaStatus = t.status;
  } catch {
    // Transient (e.g. meeting record not ready yet) — retry unless we've exhausted attempts.
    if (data.attempt < POLL_MAX_ATTEMPTS) {
      await enqueuePoll({ ...data, attempt: data.attempt + 1 }, POLL_INTERVAL_MS);
    }
    return;
  }

  const mapped = mapVexaStatus(vexaStatus);
  if (mapped) {
    await db
      .update(schema.meetings)
      .set({ status: mapped.status })
      .where(eq(schema.meetings.id, data.meetingId));
    publish(meetingStatusChannel(data.meetingId), JSON.stringify({ status: mapped.status }));

    if (mapped.completed) {
      await enqueueTranscription({
        meetingId: data.meetingId,
        platform: data.platform,
        nativeMeetingId: data.nativeMeetingId,
      });
      return;
    }
    if (mapped.terminal) return;
  }

  if (data.attempt < POLL_MAX_ATTEMPTS) {
    await enqueuePoll({ ...data, attempt: data.attempt + 1 }, POLL_INTERVAL_MS);
  }
}

/** Start the vexa-driver workers: dispatch (`meetings`) + status poll (`vexa-poll`). */
export function startVexaDriver(deps: { db: Database }): { dispatch: Worker; poll: Worker } {
  // Our own pub client for status fan-out (ioredis instance is fine — not handed to BullMQ).
  const pub = new Redis(redisUrl(), bullConnectionOptions);
  const cfg = vexaConfig();
  const vexa = new VexaClient({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey });
  const conn = bullConnection();
  const pollQueue = new Queue(QUEUE.vexaPoll, { connection: conn });
  const transcriptionQueue = new Queue(QUEUE.transcription, { connection: conn });
  const publish = (channel: string, payload: string) => void pub.publish(channel, payload);
  const enqueuePoll = async (data: PollJobData, delayMs: number) => {
    await pollQueue.add('poll', data, {
      delay: delayMs,
      // No ':' — BullMQ rejects custom job IDs containing a colon.
      jobId: `poll-${data.meetingId}-${data.attempt}`,
    });
  };

  const concurrency = Number(process.env.MAX_CONCURRENT_BOTS ?? '1');
  const dispatch = new Worker<DispatchJobData>(
    QUEUE.meetings,
    async (job: Job<DispatchJobData>) => {
      await dispatchMeeting(
        { db: deps.db, vexa, botName: cfg.botNameDefault, publish, enqueuePoll },
        job.data.meetingId,
      );
    },
    { connection: conn, concurrency },
  );

  const poll = new Worker<PollJobData>(
    QUEUE.vexaPoll,
    async (job: Job<PollJobData>) => {
      await pollMeeting(
        {
          db: deps.db,
          vexa,
          publish,
          enqueuePoll,
          enqueueTranscription: async (data) => {
            await transcriptionQueue.add('ingest', data);
          },
        },
        job.data,
      );
    },
    { connection: conn, concurrency: 5 },
  );

  for (const w of [dispatch, poll]) {
    w.on('failed', (job, err) =>
      console.error(`[vexa-driver] job ${job?.id} failed:`, err.message),
    );
  }
  return { dispatch, poll };
}
