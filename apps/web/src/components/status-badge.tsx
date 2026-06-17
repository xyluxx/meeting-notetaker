const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Scheduled', cls: 'bg-[var(--muted)] text-[var(--muted-foreground)]' },
  dispatching: { label: 'Dispatching', cls: 'bg-amber-500/15 text-amber-600' },
  joining: { label: 'Joining', cls: 'bg-amber-500/15 text-amber-600' },
  waiting_lobby: { label: 'In lobby', cls: 'bg-amber-500/15 text-amber-600' },
  recording: { label: 'Recording', cls: 'bg-red-500/15 text-red-600' },
  processing: { label: 'Processing', cls: 'bg-blue-500/15 text-blue-600' },
  summarizing: { label: 'Summarizing', cls: 'bg-blue-500/15 text-blue-600' },
  complete: { label: 'Complete', cls: 'bg-green-500/15 text-green-600' },
  skipped: { label: 'Skipped', cls: 'bg-[var(--muted)] text-[var(--muted-foreground)]' },
  cancelled: { label: 'Cancelled', cls: 'bg-[var(--muted)] text-[var(--muted-foreground)]' },
  failed_join: { label: 'Join failed', cls: 'bg-red-500/15 text-red-600' },
  failed_recording: { label: 'Recording failed', cls: 'bg-red-500/15 text-red-600' },
  failed_processing: { label: 'Processing failed', cls: 'bg-red-500/15 text-red-600' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? {
    label: status,
    cls: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  };
  const live = ['recording', 'joining', 'dispatching', 'waiting_lobby'].includes(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {live && <span className="rec-dot h-1.5 w-1.5 rounded-full" aria-hidden />}
      {s.label}
    </span>
  );
}
