import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StatusBadge } from '@/components/status-badge';
import { listMeetings } from '@/lib/meetings';
import { getCurrentSession } from '@/lib/session';
import { AddMeetingForm } from './add-meeting-form';
import { DispatchButton } from './dispatch-button';

export const dynamic = 'force-dynamic';

const TERMINAL = new Set(['complete', 'skipped', 'cancelled']);

export default async function MeetingsPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect('/login');
  const meetings = await listMeetings(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Paste a meeting link to add it, then dispatch the bot. Your lifetime history lives here.
        </p>
      </header>

      <AddMeetingForm />

      {meetings.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted-foreground)]">
          No meetings yet. Paste a Google Meet, Teams, or Zoom link above to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Meeting</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr
                  key={m.id}
                  className="hover:bg-[var(--muted)]/40 border-t border-[var(--border)]"
                >
                  <td className="px-4 py-3">
                    <Link href={`/meetings/${m.id}`} className="font-medium hover:underline">
                      {m.title ?? 'Untitled meeting'}
                    </Link>
                    <div className="text-xs text-[var(--muted-foreground)]">{m.meetUrl}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {m.startAt ? new Date(m.startAt).toLocaleString() : 'Now / unscheduled'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!TERMINAL.has(m.status) && <DispatchButton meetingId={m.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
