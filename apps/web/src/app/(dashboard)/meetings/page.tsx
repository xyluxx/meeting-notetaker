export const dynamic = 'force-dynamic';

export default function MeetingsPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Your lifetime history of recorded meetings will live here. Coming in M2–M6.
      </p>
    </div>
  );
}
