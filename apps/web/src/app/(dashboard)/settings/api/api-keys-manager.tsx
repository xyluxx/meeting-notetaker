'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createApiKeyAction, revokeApiKeyAction } from './actions';

export interface KeyView {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export function ApiKeysManager({ keys }: { keys: KeyView[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<'read' | 'readwrite'>('read');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const res = await createApiKeyAction(name, preset);
    setBusy(false);
    if (res.ok && res.key) {
      setNewKey(res.key);
      setName('');
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-sm font-semibold">Create an API key</h2>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          For your AI agent. Bearer-auth against <code>/api/v1</code> and the MCP server.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium">Name</span>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My assistant"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Access</span>
            <select
              className={inputClass}
              value={preset}
              onChange={(e) => setPreset(e.target.value as 'read' | 'readwrite')}
            >
              <option value="read">Read-only</option>
              <option value="readwrite">Read + tick action items</option>
            </select>
          </label>
          <button onClick={create} disabled={busy} className={buttonClass}>
            {busy ? 'Creating…' : 'Create key'}
          </button>
        </div>
        {newKey && (
          <div className="border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 mt-3 rounded-lg border p-3">
            <p className="text-xs font-medium text-[var(--color-accent)]">
              Copy this now — it won&apos;t be shown again:
            </p>
            <code className="mt-1 block break-all text-sm">{newKey}</code>
          </div>
        )}
      </section>

      {keys.length > 0 && (
        <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Prefix</th>
                <th className="px-4 py-2.5 font-medium">Scopes</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted-foreground)]">
                    {k.prefix}…
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                    {k.scopes.length} scopes
                  </td>
                  <td className="px-4 py-3 text-right">
                    {k.revokedAt ? (
                      <span className="text-xs text-[var(--muted-foreground)]">revoked</span>
                    ) : (
                      <button
                        onClick={async () => {
                          await revokeApiKeyAction(k.id);
                          router.refresh();
                        }}
                        className="text-xs font-medium text-red-500 hover:underline"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

const inputClass =
  'rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30';
const buttonClass =
  'shrink-0 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-foreground)] transition hover:opacity-90 disabled:opacity-50';
