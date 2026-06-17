'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addCalDavAction, addIcsAction, removeCalendarAction, syncNowAction } from './actions';

export interface CalendarItem {
  calendarId: string;
  provider: string;
  name: string | null;
  url: string | null;
  autoJoinDefault: boolean | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  syncStatus: string | null;
  errorDetail: string | null;
}

export function CalendarsManager({ calendars }: { calendars: CalendarItem[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<'ics' | 'caldav'>('ics');

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="mb-4 flex gap-2">
          <TabButton active={tab === 'ics'} onClick={() => setTab('ics')}>
            iCal / ICS URL
          </TabButton>
          <TabButton active={tab === 'caldav'} onClick={() => setTab('caldav')}>
            CalDAV
          </TabButton>
        </div>
        {tab === 'ics' ? (
          <IcsForm onDone={() => router.refresh()} />
        ) : (
          <CalDavForm onDone={() => router.refresh()} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Connected calendars</h2>
          <SyncNowButton />
        </div>
        {calendars.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No calendars yet. Add an ICS feed (e.g. Google’s private iCal address) or a CalDAV
            collection above.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {calendars.map((c) => (
              <li
                key={c.calendarId}
                className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name ?? 'Calendar'}</span>
                    <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--muted-foreground)]">
                      {c.provider}
                    </span>
                    {c.autoJoinDefault ? (
                      <span className="bg-[var(--color-accent)]/15 rounded px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]">
                        auto-join
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">{c.url}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {c.syncStatus === 'error' ? (
                      <span className="text-red-500">sync error: {c.errorDetail}</span>
                    ) : c.lastSyncAt ? (
                      `last synced ${new Date(c.lastSyncAt).toLocaleString()}`
                    ) : (
                      'not synced yet'
                    )}
                  </p>
                </div>
                <RemoveButton calendarId={c.calendarId} onDone={() => router.refresh()} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function IcsForm({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [autoJoin, setAutoJoin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await addIcsAction(url.trim(), name.trim(), autoJoin);
    setBusy(false);
    if (res.ok) {
      setUrl('');
      setName('');
      setAutoJoin(false);
      onDone();
    } else setError(res.error ?? 'Failed');
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-xs text-[var(--muted-foreground)]">
        Paste a read-only iCal/ICS subscription URL. In Google Calendar: Settings → your calendar →
        “Secret address in iCal format”.
      </p>
      <Field
        label="ICS URL"
        value={url}
        onChange={setUrl}
        placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
        required
      />
      <Field label="Name" value={name} onChange={setName} placeholder="Personal calendar" />
      <AutoJoinToggle checked={autoJoin} onChange={setAutoJoin} />
      <FormFooter busy={busy} error={error} label="Add ICS feed" />
    </form>
  );
}

function CalDavForm({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [autoJoin, setAutoJoin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await addCalDavAction(url.trim(), username.trim(), password, name.trim(), autoJoin);
    setBusy(false);
    if (res.ok) {
      setUrl('');
      setUsername('');
      setPassword('');
      setName('');
      setAutoJoin(false);
      onDone();
    } else setError(res.error ?? 'Failed');
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-xs text-[var(--muted-foreground)]">
        Paste your CalDAV calendar <em>collection</em> URL plus credentials (an app-specific
        password is recommended). The password is encrypted at rest.
      </p>
      <Field
        label="CalDAV URL"
        value={url}
        onChange={setUrl}
        placeholder="https://caldav.fastmail.com/dav/calendars/user/.../"
        required
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Field
          label="Username"
          value={username}
          onChange={setUsername}
          placeholder="you@example.com"
          required
        />
        <PasswordField value={password} onChange={setPassword} />
      </div>
      <Field label="Name" value={name} onChange={setName} placeholder="Work calendar" />
      <AutoJoinToggle checked={autoJoin} onChange={setAutoJoin} />
      <FormFooter busy={busy} error={error} label="Add CalDAV calendar" />
    </form>
  );
}

function SyncNowButton() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        const res = await syncNowAction();
        setBusy(false);
        if (res.ok) {
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        }
      }}
      disabled={busy}
      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--color-accent)] disabled:opacity-50"
    >
      {busy ? 'Syncing…' : done ? 'Sync queued ✓' : 'Sync now'}
    </button>
  );
}

function RemoveButton({ calendarId, onDone }: { calendarId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        await removeCalendarAction(calendarId);
        setBusy(false);
        onDone();
      }}
      disabled={busy}
      className="shrink-0 text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
    >
      {busy ? 'Removing…' : 'Remove'}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]'
          : 'border border-[var(--border)] hover:border-[var(--color-accent)]'
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--muted-foreground)]">{label}</span>
      <input
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--muted-foreground)]">Password</span>
      <input
        type="password"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        required
      />
    </label>
  );
}

function AutoJoinToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      Auto-join meetings from this calendar by default
    </label>
  );
}

function FormFooter({
  busy,
  error,
  label,
}: {
  busy: boolean;
  error: string | null;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button type="submit" disabled={busy} className={buttonClass}>
        {busy ? 'Adding…' : label}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30';
const buttonClass =
  'shrink-0 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-foreground)] transition hover:opacity-90 disabled:opacity-50';
