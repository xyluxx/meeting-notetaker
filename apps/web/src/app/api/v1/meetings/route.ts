import { authorizeApiRequest } from '@/lib/api-keys';
import { listMeetings } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

/** GET /api/v1/meetings — list the owner's meetings. Scope: meetings:read */
export async function GET(req: Request) {
  const authed = await authorizeApiRequest(req, ['meetings:read']);
  if (authed instanceof Response) return authed;
  const meetings = await listMeetings(authed.userId);
  return Response.json({
    data: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      platform: m.meetUrl,
      startAt: m.startAt,
      endAt: m.endAt,
      createdAt: m.createdAt,
    })),
  });
}
