'use server';

import { revalidatePath } from 'next/cache';
import type { ApiScope } from '@pmn/shared';
import { createApiKey, revokeApiKey } from '@/lib/api-keys';
import { getCurrentSession } from '@/lib/session';

const PRESETS: Record<string, ApiScope[]> = {
  read: ['meetings:read', 'transcripts:read', 'summaries:read', 'action_items:read'],
  readwrite: [
    'meetings:read',
    'transcripts:read',
    'summaries:read',
    'action_items:read',
    'action_items:write',
  ],
};

export async function createApiKeyAction(
  name: string,
  preset: 'read' | 'readwrite',
): Promise<{ ok: boolean; key?: string; error?: string }> {
  const session = await getCurrentSession();
  if (!session?.user) return { ok: false, error: 'Not signed in' };
  const scopes = PRESETS[preset] ?? PRESETS.read!;
  const created = await createApiKey(session.user.id, name.trim() || 'API key', scopes);
  revalidatePath('/settings/api');
  return { ok: true, key: created.key };
}

export async function revokeApiKeyAction(id: string): Promise<{ ok: boolean }> {
  const session = await getCurrentSession();
  if (!session?.user) return { ok: false };
  await revokeApiKey(session.user.id, id);
  revalidatePath('/settings/api');
  return { ok: true };
}
