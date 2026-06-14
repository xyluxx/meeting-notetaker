CREATE TYPE "public"."action_item_source" AS ENUM('ai', 'user');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'api_key', 'system', 'bot');--> statement-breakpoint
CREATE TYPE "public"."bot_end_reason" AS ENUM('alone_in_call', 'host_ended', 'max_duration', 'manual_stop', 'not_admitted', 'error');--> statement-breakpoint
CREATE TYPE "public"."bot_session_state" AS ENUM('requested', 'launching', 'page_loaded', 'name_set', 'camera_on', 'asked_to_join', 'in_lobby', 'admitted', 'in_call', 'recording', 'ending', 'uploading', 'done', 'not_admitted', 'timed_out', 'error', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."connected_account_provider" AS ENUM('google_calendar', 'google_gmail', 'caldav');--> statement-breakpoint
CREATE TYPE "public"."connected_account_status" AS ENUM('active', 'needs_reauth', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."meet_url_source" AS ENUM('conferenceData', 'hangoutLink', 'regex', 'manual');--> statement-breakpoint
CREATE TYPE "public"."meeting_source" AS ENUM('google', 'caldav', 'manual');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'dispatching', 'joining', 'waiting_lobby', 'recording', 'processing', 'summarizing', 'complete', 'skipped', 'cancelled', 'failed_join', 'failed_recording', 'failed_processing');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'webhook', 'desktop');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."recording_encryption" AS ENUM('sse_s3', 'sse_c', 'app_envelope', 'none');--> statement-breakpoint
CREATE TYPE "public"."recording_status" AS ENUM('uploading', 'stored', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."settings_group" AS ENUM('identity', 'accounts', 'auto_join', 'recording', 'consent', 'transcription', 'ai', 'retention', 'notifications', 'api', 'security', 'templates');--> statement-breakpoint
CREATE TYPE "public"."settings_value_type" AS ENUM('bool', 'int', 'string', 'enum', 'json');--> statement-breakpoint
CREATE TYPE "public"."summary_status" AS ENUM('pending', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('ok', 'token_expired_410', 'error');--> statement-breakpoint
CREATE TYPE "public"."transcript_engine" AS ENUM('faster_whisper', 'whisperx');--> statement-breakpoint
CREATE TYPE "public"."transcript_status" AS ENUM('pending', 'processing', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'viewer');--> statement-breakpoint
CREATE TABLE "action_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"summary_id" uuid,
	"text" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"assignee" text,
	"due_at" timestamp with time zone,
	"source" "action_item_source" DEFAULT 'ai' NOT NULL,
	"order_idx" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"hash" text NOT NULL,
	"scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_prefix_unique" UNIQUE("prefix")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" uuid,
	"metadata" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"container_id" text,
	"state" "bot_session_state" DEFAULT 'requested' NOT NULL,
	"join_token" text,
	"display_name" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"launched_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"reaped_at" timestamp with time zone,
	"end_reason" "bot_end_reason",
	"error_code" text,
	"error_detail" text,
	"screenshots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exit_code" integer,
	"resource_limits" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL,
	"sync_token" text,
	"watch_channel_id" text,
	"watch_resource_id" text,
	"watch_expires_at" timestamp with time zone,
	"last_full_sync_at" timestamp with time zone,
	"last_incremental_at" timestamp with time zone,
	"sync_status" "sync_status" DEFAULT 'ok' NOT NULL,
	"error_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_sync_state_calendar_id_unique" UNIQUE("calendar_id")
);
--> statement-breakpoint
CREATE TABLE "calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connected_account_id" uuid NOT NULL,
	"external_calendar_id" text NOT NULL,
	"name" text,
	"color" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"auto_join_default" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connected_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "connected_account_provider" NOT NULL,
	"external_account_id" text NOT NULL,
	"display_email" text,
	"scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"caldav_base_url" text,
	"caldav_username" text,
	"caldav_password_enc" text,
	"status" "connected_account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"calendar_id" uuid,
	"source" "meeting_source" NOT NULL,
	"external_event_id" text,
	"external_ical_uid" text,
	"recurring_event_id" text,
	"title" text,
	"description" text,
	"meet_url" text,
	"meet_url_source" "meet_url_source",
	"organizer_email" text,
	"attendees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"timezone" text,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"auto_join" boolean DEFAULT false NOT NULL,
	"auto_join_reason" text,
	"join_lead_minutes" integer,
	"dispatch_job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"payload" jsonb,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"bot_session_id" uuid,
	"object_key" text NOT NULL,
	"bucket" text,
	"duration_seconds" integer,
	"size_bytes" bigint,
	"width" integer,
	"height" integer,
	"codec" text,
	"checksum_sha256" text,
	"encryption" "recording_encryption" DEFAULT 'none' NOT NULL,
	"enc_key_id" text,
	"enc_metadata" jsonb,
	"status" "recording_status" DEFAULT 'uploading' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"group" "settings_group" NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"value_type" "settings_value_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"transcript_id" uuid,
	"model" text,
	"summary" text,
	"key_decisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"structured" jsonb,
	"prompt_version" text,
	"token_usage" jsonb,
	"status" "summary_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transcript_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"speaker" text,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"text" text NOT NULL,
	"words" jsonb
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"recording_id" uuid,
	"engine" "transcript_engine" DEFAULT 'faster_whisper' NOT NULL,
	"model" text,
	"language" text,
	"diarized" boolean DEFAULT false NOT NULL,
	"word_timestamps" boolean DEFAULT false NOT NULL,
	"full_text" text,
	"status" "transcript_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_summary_id_summaries_id_fk" FOREIGN KEY ("summary_id") REFERENCES "public"."summaries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_sessions" ADD CONSTRAINT "bot_sessions_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_state" ADD CONSTRAINT "calendar_sync_state_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_connected_account_id_connected_accounts_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_bot_session_id_bot_sessions_id_fk" FOREIGN KEY ("bot_session_id") REFERENCES "public"."bot_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_items_meeting_idx" ON "action_items" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "action_items_done_idx" ON "action_items" USING btree ("done");--> statement-breakpoint
CREATE INDEX "api_keys_user_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_resource_idx" ON "audit_log" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "bot_sessions_meeting_idx" ON "bot_sessions" USING btree ("meeting_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendars_account_ext_idx" ON "calendars" USING btree ("connected_account_id","external_calendar_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connected_accounts_provider_ext_idx" ON "connected_accounts" USING btree ("provider","external_account_id");--> statement-breakpoint
CREATE INDEX "connected_accounts_user_idx" ON "connected_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_calendar_event_idx" ON "meetings" USING btree ("calendar_id","external_event_id");--> statement-breakpoint
CREATE INDEX "meetings_user_start_idx" ON "meetings" USING btree ("user_id","start_at");--> statement-breakpoint
CREATE INDEX "meetings_status_idx" ON "meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recordings_meeting_idx" ON "recordings" USING btree ("meeting_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_user_group_key_idx" ON "settings" USING btree ("user_id","group","key");--> statement-breakpoint
CREATE INDEX "summaries_meeting_idx" ON "summaries" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "transcript_segments_transcript_idx" ON "transcript_segments" USING btree ("transcript_id","idx");--> statement-breakpoint
CREATE INDEX "transcripts_meeting_idx" ON "transcripts" USING btree ("meeting_id");