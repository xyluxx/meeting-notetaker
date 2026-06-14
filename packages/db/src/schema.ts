/**
 * Postgres schema (Drizzle). The single source of truth for the data model, imported by web, worker,
 * and mcp. Column casing is snake_case (configured in drizzle.config.ts); we write camelCase in TS.
 *
 * Enum string unions are kept in sync with @pmn/shared so the whole system speaks one vocabulary.
 */
import {
  BOT_END_REASONS,
  BOT_SESSION_STATES,
  CONNECTED_ACCOUNT_PROVIDERS,
  CONNECTED_ACCOUNT_STATUSES,
  MEETING_SOURCES,
  MEETING_STATUSES,
  MEET_URL_SOURCES,
} from '@pmn/shared';
import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export const meetingStatusEnum = pgEnum('meeting_status', MEETING_STATUSES);
export const botSessionStateEnum = pgEnum('bot_session_state', BOT_SESSION_STATES);
export const botEndReasonEnum = pgEnum('bot_end_reason', BOT_END_REASONS);
export const meetingSourceEnum = pgEnum('meeting_source', MEETING_SOURCES);
export const meetUrlSourceEnum = pgEnum('meet_url_source', MEET_URL_SOURCES);
export const connectedAccountProviderEnum = pgEnum(
  'connected_account_provider',
  CONNECTED_ACCOUNT_PROVIDERS,
);
export const connectedAccountStatusEnum = pgEnum(
  'connected_account_status',
  CONNECTED_ACCOUNT_STATUSES,
);
export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'viewer']);
export const syncStatusEnum = pgEnum('sync_status', ['ok', 'token_expired_410', 'error']);
export const transcriptStatusEnum = pgEnum('transcript_status', [
  'pending',
  'processing',
  'complete',
  'failed',
]);
export const transcriptEngineEnum = pgEnum('transcript_engine', ['faster_whisper', 'whisperx']);
export const recordingStatusEnum = pgEnum('recording_status', [
  'uploading',
  'stored',
  'failed',
  'deleted',
]);
export const recordingEncryptionEnum = pgEnum('recording_encryption', [
  'sse_s3',
  'sse_c',
  'app_envelope',
  'none',
]);
export const summaryStatusEnum = pgEnum('summary_status', ['pending', 'complete', 'failed']);
export const actionItemSourceEnum = pgEnum('action_item_source', ['ai', 'user']);
export const settingsGroupEnum = pgEnum('settings_group', [
  'identity',
  'accounts',
  'auto_join',
  'recording',
  'consent',
  'transcription',
  'ai',
  'retention',
  'notifications',
  'api',
  'security',
  'templates',
]);
export const settingsValueTypeEnum = pgEnum('settings_value_type', [
  'bool',
  'int',
  'string',
  'enum',
  'json',
]);
export const auditActorTypeEnum = pgEnum('audit_actor_type', ['user', 'api_key', 'system', 'bot']);
export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'webhook',
  'desktop',
]);
export const notificationStatusEnum = pgEnum('notification_status', ['pending', 'sent', 'failed']);

/* -------------------------------------------------------------------------- */
/* Shared column helpers                                                       */
/* -------------------------------------------------------------------------- */

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* -------------------------------------------------------------------------- */
/* Identity & auth                                                             */
/* -------------------------------------------------------------------------- */

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  name: text('name'),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: userRoleEnum('role').notNull().default('owner'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const apiKeys = pgTable(
  'api_keys',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    prefix: text('prefix').notNull().unique(),
    hash: text('hash').notNull(),
    scopes: text('scopes')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('api_keys_user_idx').on(t.userId)],
);

/* -------------------------------------------------------------------------- */
/* Connected external accounts & calendars                                     */
/* -------------------------------------------------------------------------- */

export const connectedAccounts = pgTable(
  'connected_accounts',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: connectedAccountProviderEnum('provider').notNull(),
    externalAccountId: text('external_account_id').notNull(),
    displayEmail: text('display_email'),
    scopes: text('scopes')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    // Envelope-encrypted credential blobs (AES-256-GCM). Never stored in plaintext.
    accessTokenEnc: text('access_token_enc'),
    refreshTokenEnc: text('refresh_token_enc'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    caldavBaseUrl: text('caldav_base_url'),
    caldavUsername: text('caldav_username'),
    caldavPasswordEnc: text('caldav_password_enc'),
    status: connectedAccountStatusEnum('status').notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('connected_accounts_provider_ext_idx').on(t.provider, t.externalAccountId),
    index('connected_accounts_user_idx').on(t.userId),
  ],
);

export const calendars = pgTable(
  'calendars',
  {
    id: id(),
    connectedAccountId: uuid('connected_account_id')
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: 'cascade' }),
    externalCalendarId: text('external_calendar_id').notNull(),
    name: text('name'),
    color: text('color'),
    isPrimary: boolean('is_primary').notNull().default(false),
    syncEnabled: boolean('sync_enabled').notNull().default(true),
    autoJoinDefault: boolean('auto_join_default'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('calendars_account_ext_idx').on(t.connectedAccountId, t.externalCalendarId)],
);

export const calendarSyncState = pgTable('calendar_sync_state', {
  id: id(),
  calendarId: uuid('calendar_id')
    .notNull()
    .references(() => calendars.id, { onDelete: 'cascade' })
    .unique(),
  syncToken: text('sync_token'),
  watchChannelId: text('watch_channel_id'),
  watchResourceId: text('watch_resource_id'),
  watchExpiresAt: timestamp('watch_expires_at', { withTimezone: true }),
  lastFullSyncAt: timestamp('last_full_sync_at', { withTimezone: true }),
  lastIncrementalAt: timestamp('last_incremental_at', { withTimezone: true }),
  syncStatus: syncStatusEnum('sync_status').notNull().default('ok'),
  errorDetail: text('error_detail'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* -------------------------------------------------------------------------- */
/* Meetings & bot lifecycle                                                    */
/* -------------------------------------------------------------------------- */

export const meetings = pgTable(
  'meetings',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    calendarId: uuid('calendar_id').references(() => calendars.id, { onDelete: 'set null' }),
    source: meetingSourceEnum('source').notNull(),
    externalEventId: text('external_event_id'),
    externalIcalUid: text('external_ical_uid'),
    recurringEventId: text('recurring_event_id'),
    title: text('title'),
    description: text('description'),
    meetUrl: text('meet_url'),
    meetUrlSource: meetUrlSourceEnum('meet_url_source'),
    organizerEmail: text('organizer_email'),
    attendees: jsonb('attendees')
      .$type<unknown[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    startAt: timestamp('start_at', { withTimezone: true }),
    endAt: timestamp('end_at', { withTimezone: true }),
    timezone: text('timezone'),
    status: meetingStatusEnum('status').notNull().default('scheduled'),
    autoJoin: boolean('auto_join').notNull().default(false),
    autoJoinReason: text('auto_join_reason'),
    joinLeadMinutes: integer('join_lead_minutes'),
    dispatchJobId: text('dispatch_job_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('meetings_calendar_event_idx').on(t.calendarId, t.externalEventId),
    index('meetings_user_start_idx').on(t.userId, t.startAt),
    index('meetings_status_idx').on(t.status),
  ],
);

export const botSessions = pgTable(
  'bot_sessions',
  {
    id: id(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    containerId: text('container_id'),
    state: botSessionStateEnum('state').notNull().default('requested'),
    joinToken: text('join_token'),
    displayName: text('display_name'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    launchedAt: timestamp('launched_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    leftAt: timestamp('left_at', { withTimezone: true }),
    reapedAt: timestamp('reaped_at', { withTimezone: true }),
    endReason: botEndReasonEnum('end_reason'),
    errorCode: text('error_code'),
    errorDetail: text('error_detail'),
    screenshots: jsonb('screenshots')
      .$type<unknown[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    exitCode: integer('exit_code'),
    resourceLimits: jsonb('resource_limits').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('bot_sessions_meeting_idx').on(t.meetingId)],
);

/* -------------------------------------------------------------------------- */
/* Media & AI outputs                                                          */
/* -------------------------------------------------------------------------- */

export const recordings = pgTable(
  'recordings',
  {
    id: id(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    botSessionId: uuid('bot_session_id').references(() => botSessions.id, { onDelete: 'set null' }),
    objectKey: text('object_key').notNull(),
    bucket: text('bucket'),
    durationSeconds: integer('duration_seconds'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    width: integer('width'),
    height: integer('height'),
    codec: text('codec'),
    checksumSha256: text('checksum_sha256'),
    encryption: recordingEncryptionEnum('encryption').notNull().default('none'),
    encKeyId: text('enc_key_id'),
    encMetadata: jsonb('enc_metadata').$type<Record<string, unknown>>(),
    status: recordingStatusEnum('status').notNull().default('uploading'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('recordings_meeting_idx').on(t.meetingId)],
);

export const transcripts = pgTable(
  'transcripts',
  {
    id: id(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    recordingId: uuid('recording_id').references(() => recordings.id, { onDelete: 'set null' }),
    engine: transcriptEngineEnum('engine').notNull().default('faster_whisper'),
    model: text('model'),
    language: text('language'),
    diarized: boolean('diarized').notNull().default(false),
    wordTimestamps: boolean('word_timestamps').notNull().default(false),
    fullText: text('full_text'),
    status: transcriptStatusEnum('status').notNull().default('pending'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('transcripts_meeting_idx').on(t.meetingId)],
);

export const transcriptSegments = pgTable(
  'transcript_segments',
  {
    id: id(),
    transcriptId: uuid('transcript_id')
      .notNull()
      .references(() => transcripts.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    speaker: text('speaker'),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    text: text('text').notNull(),
    words: jsonb('words').$type<unknown[]>(),
  },
  (t) => [index('transcript_segments_transcript_idx').on(t.transcriptId, t.idx)],
);

export const summaries = pgTable(
  'summaries',
  {
    id: id(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    transcriptId: uuid('transcript_id').references(() => transcripts.id, { onDelete: 'set null' }),
    model: text('model'),
    summary: text('summary'),
    keyDecisions: jsonb('key_decisions')
      .$type<unknown[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    structured: jsonb('structured').$type<Record<string, unknown>>(),
    promptVersion: text('prompt_version'),
    tokenUsage: jsonb('token_usage').$type<Record<string, unknown>>(),
    status: summaryStatusEnum('status').notNull().default('pending'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('summaries_meeting_idx').on(t.meetingId)],
);

export const actionItems = pgTable(
  'action_items',
  {
    id: id(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    summaryId: uuid('summary_id').references(() => summaries.id, { onDelete: 'set null' }),
    text: text('text').notNull(),
    done: boolean('done').notNull().default(false),
    assignee: text('assignee'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    source: actionItemSourceEnum('source').notNull().default('ai'),
    orderIdx: integer('order_idx').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('action_items_meeting_idx').on(t.meetingId),
    index('action_items_done_idx').on(t.done),
  ],
);

/* -------------------------------------------------------------------------- */
/* Config, audit, notifications                                                */
/* -------------------------------------------------------------------------- */

export const settings = pgTable(
  'settings',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    group: settingsGroupEnum('group').notNull(),
    key: text('key').notNull(),
    value: jsonb('value').$type<unknown>(),
    valueType: settingsValueTypeEnum('value_type').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('settings_user_group_key_idx').on(t.userId, t.group, t.key)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorType: auditActorTypeEnum('actor_type').notNull(),
    actorId: uuid('actor_id'),
    action: text('action').notNull(),
    resourceType: text('resource_type'),
    resourceId: uuid('resource_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_resource_idx').on(t.resourceType, t.resourceId, t.createdAt),
    index('audit_log_actor_idx').on(t.actorId, t.createdAt),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    meetingId: uuid('meeting_id').references(() => meetings.id, { onDelete: 'cascade' }),
    channel: notificationChannelEnum('channel').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    status: notificationStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('notifications_status_idx').on(t.status)],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                   */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  connectedAccounts: many(connectedAccounts),
  meetings: many(meetings),
  apiKeys: many(apiKeys),
}));

export const connectedAccountsRelations = relations(connectedAccounts, ({ one, many }) => ({
  user: one(users, { fields: [connectedAccounts.userId], references: [users.id] }),
  calendars: many(calendars),
}));

export const calendarsRelations = relations(calendars, ({ one, many }) => ({
  account: one(connectedAccounts, {
    fields: [calendars.connectedAccountId],
    references: [connectedAccounts.id],
  }),
  syncState: one(calendarSyncState),
  meetings: many(meetings),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  user: one(users, { fields: [meetings.userId], references: [users.id] }),
  calendar: one(calendars, { fields: [meetings.calendarId], references: [calendars.id] }),
  botSessions: many(botSessions),
  recordings: many(recordings),
  transcripts: many(transcripts),
  summaries: many(summaries),
  actionItems: many(actionItems),
}));

export const botSessionsRelations = relations(botSessions, ({ one }) => ({
  meeting: one(meetings, { fields: [botSessions.meetingId], references: [meetings.id] }),
}));

export const recordingsRelations = relations(recordings, ({ one }) => ({
  meeting: one(meetings, { fields: [recordings.meetingId], references: [meetings.id] }),
  botSession: one(botSessions, { fields: [recordings.botSessionId], references: [botSessions.id] }),
}));

export const transcriptsRelations = relations(transcripts, ({ one, many }) => ({
  meeting: one(meetings, { fields: [transcripts.meetingId], references: [meetings.id] }),
  recording: one(recordings, { fields: [transcripts.recordingId], references: [recordings.id] }),
  segments: many(transcriptSegments),
}));

export const transcriptSegmentsRelations = relations(transcriptSegments, ({ one }) => ({
  transcript: one(transcripts, {
    fields: [transcriptSegments.transcriptId],
    references: [transcripts.id],
  }),
}));

export const summariesRelations = relations(summaries, ({ one, many }) => ({
  meeting: one(meetings, { fields: [summaries.meetingId], references: [meetings.id] }),
  actionItems: many(actionItems),
}));

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
  meeting: one(meetings, { fields: [actionItems.meetingId], references: [meetings.id] }),
  summary: one(summaries, { fields: [actionItems.summaryId], references: [summaries.id] }),
}));
