'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentSession } from '@/lib/session';
import { setSettings, type SettingKey } from '@/lib/settings';

/** Persist a batch of settings for the signed-in owner. */
export async function saveSettings(
  values: Partial<Record<SettingKey, unknown>>,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getCurrentSession();
  if (!session?.user) return { ok: false, error: 'Not signed in' };
  await setSettings(session.user.id, values);
  // Branding/theme live in the layout, so refresh the whole shell.
  revalidatePath('/', 'layout');
  return { ok: true };
}
