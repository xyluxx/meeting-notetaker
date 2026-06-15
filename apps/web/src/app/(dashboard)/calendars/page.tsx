export const dynamic = 'force-dynamic';

export default function CalendarsPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Calendars</h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Add an iCal/ICS subscription URL or a CalDAV calendar, or paste a Meet link manually. Coming
        in M2 / M10.
      </p>
    </div>
  );
}
