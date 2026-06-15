'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveSettings } from './actions';

interface Initial {
  ownerName: string;
  brandName: string;
  accent: string;
  theme: string;
  botName: string;
  camText: string;
  autoJoin: boolean;
  leadSeconds: number;
}

export function SettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const brandPreview =
    s.brandName.trim() || (s.ownerName.trim() ? `${s.ownerName.trim()} NoteTaker` : 'NoteTaker');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    const res = await saveSettings({
      'identity.owner_name': s.ownerName.trim(),
      'identity.brand_name': s.brandName.trim(),
      'identity.accent': s.accent,
      'identity.theme': s.theme,
      'identity.bot_display_name': s.botName.trim(),
      'identity.cam_overlay_text': s.camText,
      'auto_join.global_enabled': s.autoJoin,
      'auto_join.lead_seconds': Number(s.leadSeconds) || 60,
    });
    if (res.ok) {
      setStatus('saved');
      router.refresh();
      setTimeout(() => setStatus('idle'), 1800);
    } else {
      setStatus('error');
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <Section title="Identity & branding" hint={`Brand preview: ${brandPreview}`}>
        <Text
          label="Your name"
          value={s.ownerName}
          onChange={(v) => setS({ ...s, ownerName: v })}
        />
        <Text
          label="Brand name (optional override)"
          value={s.brandName}
          onChange={(v) => setS({ ...s, brandName: v })}
          placeholder={s.ownerName.trim() ? `${s.ownerName.trim()} NoteTaker` : 'NoteTaker'}
        />
        <Text
          label="Bot name shown in meetings"
          value={s.botName}
          onChange={(v) => setS({ ...s, botName: v })}
          placeholder={brandPreview}
        />
        <Text
          label="Recording-tile text"
          value={s.camText}
          onChange={(v) => setS({ ...s, camText: v })}
        />
        <div className="flex gap-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Accent color</span>
            <input
              type="color"
              value={s.accent}
              onChange={(e) => setS({ ...s, accent: e.target.value })}
              className="h-9 w-16 cursor-pointer rounded-lg border border-[var(--border)] bg-transparent"
            />
          </label>
          <Select
            label="Theme"
            value={s.theme}
            onChange={(v) => setS({ ...s, theme: v })}
            options={['system', 'light', 'dark']}
          />
        </div>
      </Section>

      <Section title="Auto-join">
        <Toggle
          label="Auto-join my meetings"
          hint="When off, the bot only joins meetings you dispatch manually."
          checked={s.autoJoin}
          onChange={(v) => setS({ ...s, autoJoin: v })}
        />
        <NumberField
          label="Join lead time (seconds before start)"
          value={s.leadSeconds}
          onChange={(v) => setS({ ...s, leadSeconds: v })}
        />
      </Section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={status === 'saving'} className={buttonClass}>
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {status === 'saved' && <span className="text-sm text-green-500">Saved</span>}
        {status === 'error' && <span className="text-sm text-red-500">Could not save</span>}
      </div>
    </form>
  );
}

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30';
const buttonClass =
  'rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[var(--color-accent-foreground)] transition hover:opacity-90 disabled:opacity-50';

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{hint}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="number"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        min={0}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-[var(--muted-foreground)]">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--border)]',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition',
            checked ? 'left-[1.375rem]' : 'left-0.5',
          ].join(' ')}
        />
      </button>
    </label>
  );
}
