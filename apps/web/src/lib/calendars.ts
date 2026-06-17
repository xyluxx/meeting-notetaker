import 'server-only';
import { and, desc, eq, schema } from '@pmn/db';
import { encryptSecret } from '@pmn/shared';
import { db } from './db';
import { calendarSyncQueue } from './queue';

/**
 * Calendar sources: an iCal/ICS subscription URL or a CalDAV collection. Each source is one
 * connected_accounts row (provider 'ics' | 'caldav') + one calendars row. The worker's scheduler
 * role syncs them into `meetings`. No Google OAuth — by design.
 */

export interface CalendarView {
  calendarId: string;
  accountId: string;
  provider: string;
  name: string | null;
  url: string | null;
  autoJoinDefault: boolean | null;
  syncEnabled: boolean;
  lastSyncAt: Date | null;
  syncStatus: string | null;
  errorDetail: string | null;
}

export async function listCalendars(userId: string): Promise<CalendarView[]> {
  const rows = await db
    .select({
      calendarId: schema.calendars.id,
      accountId: schema.connectedAccounts.id,
      provider: schema.connectedAccounts.provider,
      name: schema.calendars.name,
      url: schema.connectedAccounts.caldavBaseUrl,
      autoJoinDefault: schema.calendars.autoJoinDefault,
      syncEnabled: schema.calendars.syncEnabled,
      lastSyncAt: schema.calendarSyncState.lastFullSyncAt,
      syncStatus: schema.calendarSyncState.syncStatus,
      errorDetail: schema.calendarSyncState.errorDetail,
    })
    .from(schema.calendars)
    .innerJoin(
      schema.connectedAccounts,
      eq(schema.calendars.connectedAccountId, schema.connectedAccounts.id),
    )
    .leftJoin(
      schema.calendarSyncState,
      eq(schema.calendarSyncState.calendarId, schema.calendars.id),
    )
    .where(eq(schema.connectedAccounts.userId, userId))
    .orderBy(desc(schema.calendars.createdAt));
  return rows;
}

function assertHttpUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Enter a valid URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('URL must be http(s).');
  }
  return parsed.toString();
}

async function createSource(
  userId: string,
  provider: 'ics' | 'caldav',
  url: string,
  name: string,
  autoJoinDefault: boolean,
  caldav?: { username: string; passwordEnc: string },
): Promise<string> {
  const existing = await db
    .select({ id: schema.connectedAccounts.id })
    .from(schema.connectedAccounts)
    .where(
      and(
        eq(schema.connectedAccounts.userId, userId),
        eq(schema.connectedAccounts.provider, provider),
        eq(schema.connectedAccounts.externalAccountId, url),
      ),
    )
    .limit(1);
  if (existing.length > 0) throw new Error('That calendar is already added.');

  const [account] = await db
    .insert(schema.connectedAccounts)
    .values({
      userId,
      provider,
      externalAccountId: url,
      caldavBaseUrl: url,
      caldavUsername: caldav?.username ?? null,
      caldavPasswordEnc: caldav?.passwordEnc ?? null,
      status: 'active',
    })
    .returning({ id: schema.connectedAccounts.id });

  const [calendar] = await db
    .insert(schema.calendars)
    .values({
      connectedAccountId: account!.id,
      externalCalendarId: url,
      name: name.trim() || (provider === 'ics' ? 'ICS feed' : 'CalDAV calendar'),
      autoJoinDefault,
      syncEnabled: true,
    })
    .returning({ id: schema.calendars.id });

  await calendarSyncQueue()
    .add('tick', {}, { jobId: `calendar-sync-on-add` })
    .catch(() => undefined);
  return calendar!.id;
}

export async function addIcsCalendar(
  userId: string,
  input: { url: string; name: string; autoJoinDefault: boolean },
): Promise<string> {
  return createSource(userId, 'ics', assertHttpUrl(input.url), input.name, input.autoJoinDefault);
}

export async function addCalDavCalendar(
  userId: string,
  input: {
    url: string;
    username: string;
    password: string;
    name: string;
    autoJoinDefault: boolean;
  },
): Promise<string> {
  const key = process.env.MASTER_ENCRYPTION_KEY;
  if (!key)
    throw new Error('MASTER_ENCRYPTION_KEY is not configured; cannot store CalDAV credentials.');
  if (!input.username || !input.password)
    throw new Error('CalDAV username and password are required.');
  const passwordEnc = encryptSecret(input.password, key);
  return createSource(
    userId,
    'caldav',
    assertHttpUrl(input.url),
    input.name,
    input.autoJoinDefault,
    {
      username: input.username,
      passwordEnc,
    },
  );
}

/** Remove a calendar source (and its account + meetings via cascade). Verifies ownership. */
export async function removeCalendar(userId: string, calendarId: string): Promise<void> {
  const [row] = await db
    .select({ accountId: schema.connectedAccounts.id })
    .from(schema.calendars)
    .innerJoin(
      schema.connectedAccounts,
      eq(schema.calendars.connectedAccountId, schema.connectedAccounts.id),
    )
    .where(and(eq(schema.calendars.id, calendarId), eq(schema.connectedAccounts.userId, userId)))
    .limit(1);
  if (!row) throw new Error('Calendar not found.');
  await db.delete(schema.connectedAccounts).where(eq(schema.connectedAccounts.id, row.accountId));
}

/** Enqueue an immediate calendar-sync tick. */
export async function triggerSync(): Promise<void> {
  await calendarSyncQueue().add('tick', {}, { jobId: `calendar-sync-manual` });
}
