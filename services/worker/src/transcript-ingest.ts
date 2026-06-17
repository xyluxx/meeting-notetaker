/**
 * M7 — transcript ingest. When a meeting completes, pull the transcript from Vexa, store the header +
 * ordered segments in our Postgres, advance the meeting to `summarizing`, and enqueue the summarize job.
 * Reuses the M4 VexaClient.getTranscript + mapVexaSegments.
 */
import { type Database, eq, schema } from '@pmn/db';
import { VexaClient, type VexaPlatform, type VexaSegment, mapVexaSegments } from '@pmn/shared';
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

export interface IngestJobData {
  meetingId: string;
  platform: VexaPlatform;
  nativeMeetingId: string;
}

/** Pure: render Vexa segments into a speaker-labelled transcript text block. */
export function buildTranscriptText(segments: VexaSegment[]): string {
  return segments.map((s) => `[${s.speaker ?? 'Speaker'}] ${s.text}`).join('\n');
}

export interface IngestDeps {
  db: Database;
  vexa: VexaClient;
  enqueueSummarize: (data: { meetingId: string; transcriptId: string }) => Promise<void>;
  publish: (channel: string, payload: string) => void;
}

export async function ingestTranscript(deps: IngestDeps, args: IngestJobData): Promise<void> {
  const { db, vexa, enqueueSummarize, publish } = deps;
  const t = await vexa.getTranscript(args.platform, args.nativeMeetingId);

  const fullText = buildTranscriptText(t.segments);
  const language = t.segments.find((s) => s.language)?.language ?? null;
  const diarized = t.segments.some((s) => s.speaker);

  const [row] = await db
    .insert(schema.transcripts)
    .values({
      meetingId: args.meetingId,
      engine: 'vexa',
      language,
      diarized,
      fullText,
      status: 'complete',
    })
    .returning({ id: schema.transcripts.id });
  const transcriptId = row!.id;

  const mapped = mapVexaSegments(t.segments);
  if (mapped.length > 0) {
    await db.insert(schema.transcriptSegments).values(
      mapped.map((m, idx) => ({
        transcriptId,
        idx,
        speaker: m.speaker,
        startMs: m.startMs,
        endMs: m.endMs,
        text: m.text,
      })),
    );
  }

  await db
    .update(schema.meetings)
    .set({ status: 'summarizing' })
    .where(eq(schema.meetings.id, args.meetingId));
  publish(meetingStatusChannel(args.meetingId), JSON.stringify({ status: 'summarizing' }));

  await enqueueSummarize({ meetingId: args.meetingId, transcriptId });
}

/** Start the BullMQ worker for the `transcription` (ingest) queue. */
export function startTranscriptIngest(deps: { db: Database }): Worker<IngestJobData> {
  const pub = new Redis(redisUrl(), bullConnectionOptions);
  const summarizeQueue = new Queue(QUEUE.summarize, { connection: bullConnection() });
  const cfg = vexaConfig();
  const vexa = new VexaClient({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey });

  return new Worker<IngestJobData>(
    QUEUE.transcription,
    async (job: Job<IngestJobData>) => {
      await ingestTranscript(
        {
          db: deps.db,
          vexa,
          enqueueSummarize: async (data) => {
            await summarizeQueue.add('summarize', data);
          },
          publish: (channel, payload) => void pub.publish(channel, payload),
        },
        job.data,
      );
    },
    { connection: bullConnection() },
  );
}
