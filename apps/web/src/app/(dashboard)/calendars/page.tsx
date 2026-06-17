import { redirect } from 'next/navigation';
import { listCalendars } from '@/lib/calendars';
import { getCurrentSession } from '@/lib/session';
import { CalendarsManager } from './calendars-manager';

export const dynamic = 'force-dynamic';

export default async function CalendarsPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect('/login');
  const calendars = await listCalendars(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calendars</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Subscribe to an iCal/ICS feed or a CalDAV calendar. Meetings with a Meet, Teams, or Zoom
          link are imported automatically and joined per your auto-join rules. No Google sign-in
          required.
        </p>
      </header>
      <CalendarsManager
        calendars={calendars.map((c) => ({
          calendarId: c.calendarId,
          provider: c.provider,
          name: c.name,
          url: c.url,
          autoJoinDefault: c.autoJoinDefault,
          syncEnabled: c.syncEnabled,
          lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
          syncStatus: c.syncStatus,
          errorDetail: c.errorDetail,
        }))}
      />
    </div>
  );
}
