import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { countMeetings, countOpenActionItems, listMeetings } from '@/lib/meetings';
import { getCurrentSession } from '@/lib/session';
import { getSettings, resolveBotName, resolveBrand } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function DashboardHome() {
  const session = await getCurrentSession();
  if (!session?.user) return null; // the layout guards/redirects; keeps types happy
  const userId = session.user.id;

  const [settings, total, completed, openItems, recent] = await Promise.all([
    getSettings(userId),
    countMeetings(userId),
    countMeetings(userId, { status: 'complete' }),
    countOpenActionItems(userId),
    listMeetings(userId, { limit: 5 }),
  ]);

  const brand = resolveBrand(settings);
  const botName = resolveBotName(settings);
  const autoJoin = Boolean(settings['auto_join.global_enabled']);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{brand}</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Your meetings, recorded and summarized — on your own infrastructure.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Meetings" value={String(total)} />
        <Stat label="Completed" value={String(completed)} />
        <Stat label="Open action items" value={String(openItems)} />
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-6">
        <p className="text-sm text-[var(--muted-foreground)]">
          Auto-join is{' '}
          <span className="font-medium text-[var(--foreground)]">{autoJoin ? 'on' : 'off'}</span>.
          The bot joins meetings as{' '}
          <span className="font-medium text-[var(--foreground)]">“{botName}”</span>.{' '}
          <Link href="/settings" className="text-[var(--color-accent)] hover:underline">
            Change settings
          </Link>{' '}
          or{' '}
          <Link href="/calendars" className="text-[var(--color-accent)] hover:underline">
            connect a calendar
          </Link>
          .
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent meetings</h2>
          <Link href="/meetings" className="text-xs text-[var(--color-accent)] hover:underline">
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
            No meetings yet.{' '}
            <Link href="/meetings" className="text-[var(--color-accent)] hover:underline">
              Add one
            </Link>{' '}
            to get started.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/meetings/${m.id}`}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--color-accent)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {m.title ?? 'Untitled meeting'}
                    </span>
                    <span className="block text-xs text-[var(--muted-foreground)]">
                      {m.startAt ? new Date(m.startAt).toLocaleString() : 'Unscheduled'}
                    </span>
                  </span>
                  <StatusBadge status={m.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
}
