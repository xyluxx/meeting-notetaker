'use server';

import { revalidatePath } from 'next/cache';
import { addCalDavCalendar, addIcsCalendar, removeCalendar, triggerSync } from '@/lib/calendars';
import { getCurrentSession } from '@/lib/session';

type Result = { ok: boolean; error?: string };

export async function addIcsAction(
  url: string,
  name: string,
  autoJoinDefault: boolean,
): Promise<Result> {
  const session = await getCurrentSession();
  if (!session?.user) return { ok: false, error: 'Not signed in' };
  try {
    await addIcsCalendar(session.user.id, { url, name, autoJoinDefault });
    revalidatePath('/calendars');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function addCalDavAction(
  url: string,
  username: string,
  password: string,
  name: string,
  autoJoinDefault: boolean,
): Promise<Result> {
  const session = await getCurrentSession();
  if (!session?.user) return { ok: false, error: 'Not signed in' };
  try {
    await addCalDavCalendar(session.user.id, { url, username, password, name, autoJoinDefault });
    revalidatePath('/calendars');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function removeCalendarAction(calendarId: string): Promise<Result> {
  const session = await getCurrentSession();
  if (!session?.user) return { ok: false, error: 'Not signed in' };
  try {
    await removeCalendar(session.user.id, calendarId);
    revalidatePath('/calendars');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function syncNowAction(): Promise<Result> {
  const session = await getCurrentSession();
  if (!session?.user) return { ok: false, error: 'Not signed in' };
  try {
    await triggerSync();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
