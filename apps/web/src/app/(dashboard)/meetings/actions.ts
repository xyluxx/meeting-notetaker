'use server';

import { revalidatePath } from 'next/cache';
import { createMeeting, dispatchMeeting, toggleActionItem } from '@/lib/meetings';
import { getCurrentSession } from '@/lib/session';

export async function addMeeting(
  rawLink: string,
  title: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const session = await getCurrentSession();
  if (!session?.user) return { ok: false, error: 'Not signed in' };
  try {
    const id = await createMeeting(session.user.id, { rawLink, title });
    revalidatePath('/meetings');
    revalidatePath('/');
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to add meeting' };
  }
}

export async function dispatchMeetingAction(
  meetingId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getCurrentSession();
  if (!session?.user) return { ok: false, error: 'Not signed in' };
  try {
    await dispatchMeeting(session.user.id, meetingId);
    revalidatePath('/meetings');
    revalidatePath(`/meetings/${meetingId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Dispatch failed' };
  }
}

export async function setActionItemDone(
  actionItemId: string,
  done: boolean,
): Promise<{ ok: boolean }> {
  const session = await getCurrentSession();
  if (!session?.user) return { ok: false };
  await toggleActionItem(session.user.id, actionItemId, done);
  return { ok: true };
}
