'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-sm text-[var(--muted-foreground)]">
        An unexpected error occurred. You can try again — if it keeps happening, check the server
        logs.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-[var(--muted-foreground)]">ref: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-foreground)] transition hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
