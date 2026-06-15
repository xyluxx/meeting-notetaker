'use server';

import { getCurrentSession } from '@/lib/session';
import { setSettings } from '@/lib/settings';

/** Persist the owner's name (and derived branding defaults) after sign-up. */
export async function completeOnboarding(name: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getCurrentSession();
  if (!session?.user) return { ok: false, error: 'Not signed in' };
  const clean = name.trim();
  await setSettings(session.user.id, {
    'identity.owner_name': clean,
  });
  return { ok: true };
}
