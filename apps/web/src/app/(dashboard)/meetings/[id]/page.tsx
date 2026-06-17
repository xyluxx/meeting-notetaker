import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getMeetingDetail } from '@/lib/meetings';
import { getCurrentSession } from '@/lib/session';
import { ActionItems } from './action-items';
import { LiveStatus } from './live-status';

export const dynamic = 'force-dynamic';

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user) redirect('/login');
  const { id } = await params;
  const detail = await getMeetingDetail(session.user.id, id);
  if (!detail) notFound();

  const { meeting, transcript, segments, summary, actionItems } = detail;
  const decisions = (summary?.keyDecisions ?? []) as { text: string }[];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href="/meetings" className="text-sm text-[var(--muted-foreground)] hover:underline">
          ← Meetings
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{meeting.title ?? 'Meeting'}</h1>
          <LiveStatus meetingId={meeting.id} initialStatus={meeting.status} />
        </div>
        <a
          href={meeting.meetUrl ?? '#'}
          className="text-sm text-[var(--color-accent)] hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {meeting.meetUrl}
        </a>
      </header>

      {/* Two-column: summary/actions on the right, transcript on the left (stacks on mobile). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold">Transcript</h2>
          {segments.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
              {segments.map((seg) => (
                <p key={seg.id} className="flex gap-3">
                  <span className="w-12 shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
                    {fmtMs(seg.startMs)}
                  </span>
                  <span>
                    {seg.speaker && <span className="font-medium">{seg.speaker}: </span>}
                    {seg.text}
                  </span>
                </p>
              ))}
            </div>
          ) : (
            <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted-foreground)]">
              {['complete', 'failed_processing'].includes(meeting.status)
                ? 'No transcript was produced for this meeting.'
                : 'Transcript will appear here after the meeting is recorded and processed.'}
            </p>
          )}
        </section>

        <aside className="flex flex-col gap-6 lg:col-span-2">
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5">
            <h2 className="mb-2 text-sm font-semibold">AI summary</h2>
            <p className="whitespace-pre-wrap text-sm text-[var(--foreground)]">
              {summary?.summary ?? 'Not generated yet.'}
            </p>
            {summary?.model && (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">via {summary.model}</p>
            )}
          </div>

          {decisions.length > 0 && (
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5">
              <h2 className="mb-2 text-sm font-semibold">Key decisions</h2>
              <ul className="list-disc pl-5 text-sm">
                {decisions.map((d, i) => (
                  <li key={i}>{d.text}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5">
            <h2 className="mb-3 text-sm font-semibold">Action items</h2>
            <ActionItems
              items={actionItems.map((a) => ({
                id: a.id,
                text: a.text,
                done: a.done,
                assignee: a.assignee,
              }))}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
