import { authorizeApiRequest } from '@/lib/api-keys';
import { toggleActionItem } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

/** PATCH /api/v1/action-items/:id { done } — toggle an action item. Scope: action_items:write */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authed = await authorizeApiRequest(req, ['action_items:write']);
  if (authed instanceof Response) return authed;
  const { id } = await ctx.params;
  let body: { done?: unknown };
  try {
    body = (await req.json()) as { done?: unknown };
  } catch {
    return Response.json(
      { error: { code: 'bad_request', message: 'Invalid JSON' } },
      { status: 400 },
    );
  }
  if (typeof body.done !== 'boolean') {
    return Response.json(
      { error: { code: 'bad_request', message: '`done` (boolean) required' } },
      { status: 400 },
    );
  }
  try {
    await toggleActionItem(authed.userId, id, body.done);
  } catch {
    return Response.json({ error: { code: 'not_found' } }, { status: 404 });
  }
  return Response.json({ id, done: body.done });
}
