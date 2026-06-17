import { and, eq, schema } from '@pmn/db';
import { meetingStatusChannel, meetingTranscriptChannel } from '@pmn/shared';
import { Redis } from 'ioredis';
import { db } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * SSE stream of a meeting's live state. The worker publishes status transitions to
 * `meeting:{id}:status` and in-progress transcript segments to `meeting:{id}:transcript`; we
 * subscribe to both and forward each payload as a Server-Sent Event. The dashboard's EventSource
 * distinguishes them by shape ({status} vs {type:'transcript', segments}). No polling on the client.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user) return new Response('Unauthorized', { status: 401 });
  const { id } = await ctx.params;

  // Ownership check — never stream another user's meeting.
  const [owned] = await db
    .select({ id: schema.meetings.id })
    .from(schema.meetings)
    .where(and(eq(schema.meetings.id, id), eq(schema.meetings.userId, session.user.id)))
    .limit(1);
  if (!owned) return new Response('Not found', { status: 404 });

  const statusChannel = meetingStatusChannel(id);
  const transcriptChannel = meetingTranscriptChannel(id);
  const sub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let beat: NodeJS.Timeout | undefined;
      // A safe enqueue: once the client disconnects the controller is closed and enqueue throws —
      // tear down rather than crash.
      const safeEnqueue = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          if (beat) clearInterval(beat);
          void sub.quit().catch(() => undefined);
        }
      };

      // Without an 'error' listener an ioredis connection error is an unhandled EventEmitter 'error'
      // that throws and can crash the server. Surface it to the stream instead.
      sub.on('error', (err) => {
        if (beat) clearInterval(beat);
        try {
          controller.error(err);
        } catch {
          /* already closed */
        }
        void sub.quit().catch(() => undefined);
      });

      safeEnqueue(': connected\n\n');
      sub.on('message', (ch, msg) => {
        if (ch === statusChannel || ch === transcriptChannel) safeEnqueue(`data: ${msg}\n\n`);
      });
      // Heartbeat keeps proxies from closing an idle stream.
      beat = setInterval(() => safeEnqueue(': ping\n\n'), 25_000);
      await sub.subscribe(statusChannel, transcriptChannel);
      (sub as unknown as { _beat?: NodeJS.Timeout })._beat = beat;
    },
    async cancel() {
      const beat = (sub as unknown as { _beat?: NodeJS.Timeout })._beat;
      if (beat) clearInterval(beat);
      await sub.quit().catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
