'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addMeeting } from './actions';

export function AddMeetingForm() {
  const router = useRouter();
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await addMeeting(link.trim(), title.trim());
    setBusy(false);
    if (res.ok) {
      setLink('');
      setTitle('');
      router.refresh();
    } else {
      setError(res.error ?? 'Failed');
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            Paste a Google Meet, Teams, or Zoom link
          </span>
          <input
            className={inputClass}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5 sm:w-56">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            Title (optional)
          </span>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekly standup"
          />
        </label>
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? 'Adding…' : 'Add meeting'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </form>
  );
}

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30';
const buttonClass =
  'shrink-0 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-foreground)] transition hover:opacity-90 disabled:opacity-50';
