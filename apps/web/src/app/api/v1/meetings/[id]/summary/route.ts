import { authorizeApiRequest } from '@/lib/api-keys';
import { getMeetingDetail } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

/** GET /api/v1/meetings/:id/summary — AI summary + key decisions + action items. Scope: summaries:read */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authed = await authorizeApiRequest(req, ['summaries:read']);
  if (authed instanceof Response) return authed;
  const { id } = await ctx.params;
  const d = await getMeetingDetail(authed.userId, id);
  if (!d) return Response.json({ error: { code: 'not_found' } }, { status: 404 });
  return Response.json({
    meetingId: id,
    model: d.summary?.model ?? null,
    summary: d.summary?.summary ?? null,
    keyDecisions: d.summary?.keyDecisions ?? [],
    actionItems: d.actionItems.map((a) => ({
      id: a.id,
      text: a.text,
      done: a.done,
      assignee: a.assignee,
    })),
  });
}
