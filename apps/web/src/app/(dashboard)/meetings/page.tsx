import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StatusBadge } from '@/components/status-badge';
import { countMeetings, listMeetings } from '@/lib/meetings';
import { getCurrentSession } from '@/lib/session';
import { AddMeetingForm } from './add-meeting-form';
import { DispatchButton } from './dispatch-button';

export const dynamic = 'force-dynamic';

const TERMINAL = new Set(['complete', 'skipped', 'cancelled']);
const FAILED = new Set(['failed_join', 'failed_recording', 'failed_processing']);
const PAGE_SIZE = 25;

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'recording', label: 'Recording' },
  { value: 'summarizing', label: 'Summarizing' },
  { value: 'complete', label: 'Complete' },
  { value: 'failed_join', label: 'Join failed' },
  { value: 'failed_recording', label: 'Recording failed' },
  { value: 'failed_processing', label: 'Processing failed' },
];

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session?.user) redirect('/login');

  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const status = sp.status ?? '';
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const opts = { query, status, limit: PAGE_SIZE, offset };
  const [meetings, total] = await Promise.all([
    listMeetings(session.user.id, opts),
    countMeetings(session.user.id, { query, status }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isFiltering = query !== '' || status !== '';

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (status) params.set('status', status);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/meetings?${qs}` : '/meetings';
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Paste a meeting link to add it, then dispatch the bot. Your lifetime history lives here.
        </p>
      </header>

      <AddMeetingForm />

      {/* Search + status filter (plain GET form — no JS needed). */}
      <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by title or description…"
          className="focus:ring-[var(--color-accent)]/30 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--muted)]"
        >
          Search
        </button>
        {isFiltering && (
          <Link
            href="/meetings"
            className="px-2 py-2 text-sm text-[var(--muted-foreground)] hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      {meetings.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted-foreground)]">
          {isFiltering
            ? 'No meetings match your search.'
            : 'No meetings yet. Paste a Google Meet, Teams, or Zoom link above to get started.'}
        </div>
      ) : (
        <>
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
                      <div className="truncate text-xs text-[var(--muted-foreground)]">
                        {m.meetUrl}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {m.startAt ? new Date(m.startAt).toLocaleString() : 'Now / unscheduled'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!TERMINAL.has(m.status) && (
                        <DispatchButton
                          meetingId={m.id}
                          label={FAILED.has(m.status) ? 'Retry' : 'Dispatch bot'}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
            <span>
              {total} meeting{total === 1 ? '' : 's'}
              {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ''}
            </span>
            {pageCount > 1 && (
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={pageHref(page - 1)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 transition hover:bg-[var(--muted)]"
                  >
                    ← Prev
                  </Link>
                )}
                {page < pageCount && (
                  <Link
                    href={pageHref(page + 1)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 transition hover:bg-[var(--muted)]"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
