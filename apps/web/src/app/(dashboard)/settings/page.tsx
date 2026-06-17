import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect('/login');
  const settings = await getSettings(session.user.id);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Identity, branding, and auto-join behavior. More sections arrive with later milestones.
        </p>
      </header>
      <SettingsForm
        initial={{
          ownerName: String(settings['identity.owner_name'] ?? ''),
          brandName: String(settings['identity.brand_name'] ?? ''),
          accent: String(settings['identity.accent'] ?? '#6366F1'),
          theme: String(settings['identity.theme'] ?? 'system'),
          botName: String(settings['identity.bot_display_name'] ?? ''),
          camText: String(settings['identity.cam_overlay_text'] ?? 'Recording in progress'),
          autoJoin: Boolean(settings['auto_join.global_enabled']),
          leadSeconds: Number(settings['auto_join.lead_seconds'] ?? 60),
        }}
      />
      <Link
        href="/settings/api"
        className="flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-5 transition hover:border-[var(--color-accent)]"
      >
        <div>
          <h2 className="text-sm font-semibold">API &amp; MCP access</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Issue scoped keys for your AI agent to read meetings over REST and MCP.
          </p>
        </div>
        <span aria-hidden className="text-[var(--muted-foreground)]">
          &rarr;
        </span>
      </Link>
    </div>
  );
}
