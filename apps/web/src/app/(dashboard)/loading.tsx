// Skeleton shown while a dashboard route's server component streams in.
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="h-7 w-48 rounded bg-[var(--muted)]" />
      <div className="h-4 w-80 max-w-full rounded bg-[var(--muted)]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-[var(--radius-card)] bg-[var(--muted)]" />
        <div className="h-24 rounded-[var(--radius-card)] bg-[var(--muted)]" />
        <div className="h-24 rounded-[var(--radius-card)] bg-[var(--muted)]" />
      </div>
      <div className="h-48 rounded-[var(--radius-card)] bg-[var(--muted)]" />
    </div>
  );
}
