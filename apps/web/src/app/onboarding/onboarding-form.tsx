'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signUp } from '@/lib/auth-client';
import { completeOnboarding } from './actions';

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const brandPreview = name.trim() ? `${name.trim()} NoteTaker` : 'NoteTaker';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await signUp.email({ email, password, name: name.trim() });
    if (res.error) {
      setError(res.error.message ?? 'Sign-up failed');
      setBusy(false);
      return;
    }
    await completeOnboarding(name);
    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Your name" hint={`Brand preview: ${brandPreview}`}>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex"
          required
          autoFocus
        />
      </Field>
      <Field label="Email">
        <input
          className={inputClass}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <input
          className={inputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </Field>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button type="submit" disabled={busy} className={buttonClass}>
        {busy ? 'Creating…' : 'Create my dashboard'}
      </button>
    </form>
  );
}

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30';
const buttonClass =
  'mt-2 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[var(--color-accent-foreground)] transition hover:opacity-90 disabled:opacity-50';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-[var(--muted-foreground)]">{hint}</span>}
    </label>
  );
}
