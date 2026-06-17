import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--background)] px-6 text-center text-[var(--foreground)]">
      <p className="text-sm font-medium text-[var(--color-accent)]">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">This page doesn’t exist</h1>
      <p className="max-w-sm text-sm text-[var(--muted-foreground)]">
        The page you’re looking for may have been moved, or the meeting may have been deleted.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-foreground)] transition hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
