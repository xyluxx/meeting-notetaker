'use client';

// Root error boundary — replaces the whole document if the root layout itself throws.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          textAlign: 'center',
          padding: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>The app failed to load</h1>
        <p style={{ maxWidth: '24rem', color: '#666' }}>
          A fatal error occurred while rendering. Try reloading.
        </p>
        {error.digest && (
          <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#888' }}>
            ref: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            borderRadius: '0.5rem',
            background: '#6366F1',
            color: 'white',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
