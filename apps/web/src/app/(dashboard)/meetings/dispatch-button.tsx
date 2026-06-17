'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { dispatchMeetingAction } from './actions';

export function DispatchButton({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const res = await dispatchMeetingAction(meetingId);
          setBusy(false);
          if (res.ok) router.refresh();
          else setErr(res.error ?? 'Failed');
        }}
        disabled={busy}
        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--muted)] disabled:opacity-50"
      >
        {busy ? 'Dispatching…' : 'Dispatch bot'}
      </button>
      {err && <span className="text-xs text-red-500">{err}</span>}
    </span>
  );
}
