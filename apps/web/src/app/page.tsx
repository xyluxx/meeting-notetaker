export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex items-center gap-3">
        <span className="rec-dot h-3 w-3 rounded-full" aria-hidden />
        <span className="text-sm font-medium tracking-wide text-[var(--muted-foreground)]">
          NoteTaker
        </span>
      </div>
      <h1 className="text-4xl font-semibold tracking-tight">
        Your self-hosted meeting recorder is taking shape.
      </h1>
      <p className="max-w-md text-[var(--muted-foreground)]">
        Records your Google Meet calls, transcribes them, and turns each into an AI summary with
        action items — all on your own infrastructure.
      </p>
      <a
        href="/api/v1/healthz"
        className="rounded-[var(--radius-card)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-[var(--color-accent-foreground)] transition hover:opacity-90"
      >
        Check API health
      </a>
    </main>
  );
}
