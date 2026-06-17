import { authorizeApiRequest } from '@/lib/api-keys';
import { getMeetingDetail } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

/** GET /api/v1/meetings/:id/transcript — segments + full text. Scope: transcripts:read */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authed = await authorizeApiRequest(req, ['transcripts:read']);
  if (authed instanceof Response) return authed;
  const { id } = await ctx.params;
  const d = await getMeetingDetail(authed.userId, id);
  if (!d) return Response.json({ error: { code: 'not_found' } }, { status: 404 });
  return Response.json({
    meetingId: id,
    language: d.transcript?.language ?? null,
    diarized: d.transcript?.diarized ?? false,
    fullText: d.transcript?.fullText ?? null,
    segments: d.segments.map((s) => ({
      speaker: s.speaker,
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
    })),
  });
}
