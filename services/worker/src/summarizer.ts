/**
 * M8 — summarizer. Consumes the `summarize` queue: loads a stored transcript, asks OpenRouter for a
 * structured summary + key decisions + action items, writes a summaries row and tickable action_items
 * rows, marks the meeting complete, and publishes the final status.
 */
import { type Database, eq, schema } from '@pmn/db';
import { OpenRouterClient, PROMPT_VERSION, summarizeTranscript } from '@pmn/shared';
import { type Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { aiConfig } from './ai-config.js';
import {
  QUEUE,
  bullConnection,
  bullConnectionOptions,
  meetingStatusChannel,
  redisUrl,
} from './queues.js';

export interface SummarizeJobData {
  meetingId: string;
  transcriptId: string;
}

export interface SummarizeDeps {
  db: Database;
  openrouter: OpenRouterClient;
  model: string;
  publish: (channel: string, payload: string) => void;
}

export async function runSummarize(deps: SummarizeDeps, args: SummarizeJobData): Promise<void> {
  const { db, openrouter, model, publish } = deps;

  const [transcript] = await db
    .select({ fullText: schema.transcripts.fullText })
    .from(schema.transcripts)
    .where(eq(schema.transcripts.id, args.transcriptId))
    .limit(1);
  if (!transcript?.fullText) throw new Error(`runSummarize: transcript ${args.transcriptId} empty`);

  const result = await summarizeTranscript(openrouter, { transcript: transcript.fullText, model });

  const [summaryRow] = await db
    .insert(schema.summaries)
    .values({
      meetingId: args.meetingId,
      transcriptId: args.transcriptId,
      model: result.model,
      summary: result.summary,
      keyDecisions: result.keyDecisions,
      promptVersion: PROMPT_VERSION,
      status: result.ok ? 'complete' : 'failed',
    })
    .returning({ id: schema.summaries.id });
  const summaryId = summaryRow!.id;

  if (result.actionItems.length > 0) {
    await db.insert(schema.actionItems).values(
      result.actionItems.map((a, idx) => ({
        meetingId: args.meetingId,
        summaryId,
        // Preserve a free-form due hint inside the text (our due_at is a timestamp we can't parse "tomorrow" into).
        text: a.due ? `${a.text} (due: ${a.due})` : a.text,
        assignee: a.owner,
        source: 'ai' as const,
        orderIdx: idx,
      })),
    );
  }

  await db
    .update(schema.meetings)
    .set({ status: 'complete' })
    .where(eq(schema.meetings.id, args.meetingId));
  publish(
    meetingStatusChannel(args.meetingId),
    JSON.stringify({ status: 'complete', actionItems: result.actionItems.length }),
  );
}

/** Start the BullMQ worker for the `summarize` queue. */
export function startSummarizer(deps: { db: Database }): Worker<SummarizeJobData> {
  const pub = new Redis(redisUrl(), bullConnectionOptions);
  const cfg = aiConfig();
  const openrouter = new OpenRouterClient({ apiKey: cfg.apiKey });

  return new Worker<SummarizeJobData>(
    QUEUE.summarize,
    async (job: Job<SummarizeJobData>) => {
      await runSummarize(
        {
          db: deps.db,
          openrouter,
          model: cfg.model,
          publish: (channel, payload) => void pub.publish(channel, payload),
        },
        job.data,
      );
    },
    { connection: bullConnection() },
  );
}
