import { and, eq, schema } from '@pmn/db';
import { Redis } from 'ioredis';
import { db } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * SSE stream of a meeting's live status. The worker publishes every transition to the Redis channel
 * `meeting:{id}:status` (dispatch -> joining -> recording -> summarizing -> complete); we subscribe and
 * forward each as a Server-Sent Event. The dashboard's EventSource updates without polling.
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

  const channel = `meeting:${id}:status`;
  const sub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'));
      sub.on('message', (ch, msg) => {
        if (ch === channel) controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
      });
      // Heartbeat keeps proxies from closing an idle stream.
      const beat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(beat);
        }
      }, 25_000);
      await sub.subscribe(channel);
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
