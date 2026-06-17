import { redirect } from 'next/navigation';
import { listApiKeys } from '@/lib/api-keys';
import { getCurrentSession } from '@/lib/session';
import { ApiKeysManager } from './api-keys-manager';

export const dynamic = 'force-dynamic';

export default async function ApiSettingsPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect('/login');
  const keys = await listApiKeys(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">API &amp; MCP access</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Issue scoped keys so your AI agent can query meetings, transcripts, summaries, and action
          items over the REST API (<code>/api/v1</code>) and the MCP server.
        </p>
      </header>
      <ApiKeysManager
        keys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          scopes: k.scopes,
          lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
          revokedAt: k.revokedAt ? k.revokedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
