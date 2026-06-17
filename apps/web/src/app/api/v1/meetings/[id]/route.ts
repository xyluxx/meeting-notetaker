import { authorizeApiRequest } from '@/lib/api-keys';
import { getMeetingDetail } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

/** GET /api/v1/meetings/:id — meeting metadata + summary + action-item count. Scope: meetings:read */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authed = await authorizeApiRequest(req, ['meetings:read']);
  if (authed instanceof Response) return authed;
  const { id } = await ctx.params;
  const d = await getMeetingDetail(authed.userId, id);
  if (!d) return Response.json({ error: { code: 'not_found' } }, { status: 404 });
  return Response.json({
    id: d.meeting.id,
    title: d.meeting.title,
    status: d.meeting.status,
    meetUrl: d.meeting.meetUrl,
    startAt: d.meeting.startAt,
    endAt: d.meeting.endAt,
    hasTranscript: Boolean(d.transcript),
    summaryAvailable: Boolean(d.summary),
    actionItemCount: d.actionItems.length,
  });
}
