/**
 * Shared domain types and enums. These mirror the Postgres enums defined in @pmn/db and are the
 * vocabulary the whole system speaks (web, worker, bot, mcp).
 */

/** End-to-end lifecycle of a meeting, from calendar ingest to a ready summary. */
export const MEETING_STATUSES = [
  'scheduled',
  'dispatching',
  'joining',
  'waiting_lobby',
  'recording',
  'processing',
  'summarizing',
  'complete',
  'skipped',
  'cancelled',
  'failed_join',
  'failed_recording',
  'failed_processing',
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

/** Terminal/branch statuses that require no further automated work. */
export const TERMINAL_MEETING_STATUSES: ReadonlySet<MeetingStatus> = new Set([
  'complete',
  'skipped',
  'cancelled',
  'failed_join',
  'failed_recording',
  'failed_processing',
]);

/** Fine-grained state of a single bot join attempt (one meeting may have several on retry). */
export const BOT_SESSION_STATES = [
  'requested',
  'launching',
  'page_loaded',
  'name_set',
  'camera_on',
  'asked_to_join',
  'in_lobby',
  'admitted',
  'in_call',
  'recording',
  'ending',
  'uploading',
  'done',
  'not_admitted',
  'timed_out',
  'error',
  'stopped',
] as const;
export type BotSessionState = (typeof BOT_SESSION_STATES)[number];

/** Why a bot left a call — drives UX copy and retry decisions. */
export const BOT_END_REASONS = [
  'alone_in_call',
  'host_ended',
  'max_duration',
  'manual_stop',
  'not_admitted',
  'error',
] as const;
export type BotEndReason = (typeof BOT_END_REASONS)[number];

/** Source of a normalized meeting. */
export const MEETING_SOURCES = ['google', 'caldav', 'manual'] as const;
export type MeetingSource = (typeof MEETING_SOURCES)[number];

/** Provenance of an extracted Meet URL (useful for debugging selector/parse drift). */
export const MEET_URL_SOURCES = ['conferenceData', 'hangoutLink', 'regex', 'manual'] as const;
export type MeetUrlSource = (typeof MEET_URL_SOURCES)[number];

/** Kind of external account connected to the dashboard. */
export const CONNECTED_ACCOUNT_PROVIDERS = ['google_calendar', 'google_gmail', 'caldav'] as const;
export type ConnectedAccountProvider = (typeof CONNECTED_ACCOUNT_PROVIDERS)[number];

/** Health of a connected account's credentials. */
export const CONNECTED_ACCOUNT_STATUSES = ['active', 'needs_reauth', 'revoked'] as const;
export type ConnectedAccountStatus = (typeof CONNECTED_ACCOUNT_STATUSES)[number];

/** Behavior toward external/unknown participants (consent posture). */
export const EXTERNAL_PARTICIPANT_BEHAVIORS = [
  'record',
  'announce_only',
  'auto_skip',
  'ask',
] as const;
export type ExternalParticipantBehavior = (typeof EXTERNAL_PARTICIPANT_BEHAVIORS)[number];

/** A meeting attendee as normalized from any calendar source. */
export interface Attendee {
  email: string;
  name?: string;
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  optional?: boolean;
  organizer?: boolean;
}
