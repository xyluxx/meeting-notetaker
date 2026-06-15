import { getCurrentSession } from '@/lib/session';
import { getSettings, resolveBotName, resolveBrand } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function DashboardHome() {
  const session = await getCurrentSession();
  const settings = session?.user ? await getSettings(session.user.id) : null;
  const brand = settings ? resolveBrand(settings) : 'NoteTaker';
  const botName = settings ? resolveBotName(settings) : 'NoteTaker';
  const autoJoin = Boolean(settings?.['auto_join.global_enabled']);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{brand}</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Your meetings, recorded and summarized — on your own infrastructure.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Meetings recorded" value="0" />
        <Stat label="Hours captured" value="0" />
        <Stat label="Open action items" value="0" />
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-sm font-semibold">Nothing recording right now</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Auto-join is{' '}
          <span className="font-medium text-[var(--foreground)]">{autoJoin ? 'on' : 'off'}</span>.
          The bot joins meetings as{' '}
          <span className="font-medium text-[var(--foreground)]">“{botName}”</span>. Connecting
          calendars and dispatching the bot arrive in the next milestones.
        </p>
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
