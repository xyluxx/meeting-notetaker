'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { dispatchMeetingAction } from './actions';

export function DispatchButton({
  meetingId,
  label = 'Dispatch bot',
}: {
  meetingId: string;
  label?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <button
      onClick={async () => {
        setBusy(true);
        const res = await dispatchMeetingAction(meetingId);
        setBusy(false);
        if (res.ok) {
          toast('Bot dispatched — it will join the meeting shortly.', 'success');
          router.refresh();
        } else {
          toast(res.error ?? 'Failed to dispatch the bot.', 'error');
        }
      }}
      disabled={busy}
      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--muted)] disabled:opacity-50"
    >
      {busy ? 'Dispatching…' : label}
    </button>
  );
}
