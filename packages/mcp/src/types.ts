import { schema } from '@pmn/db';

export type MeetingRow = (typeof schema.meetings)['$inferSelect'];
export type TranscriptRow = (typeof schema.transcripts)['$inferSelect'];
export type TranscriptSegmentRow = (typeof schema.transcriptSegments)['$inferSelect'];
export type SummaryRow = (typeof schema.summaries)['$inferSelect'];
export type ActionItemRow = (typeof schema.actionItems)['$inferSelect'];

export interface SearchMeetingsOpts {
  query?: string;
  status?: string;
  limit: number;
}

export interface ListActionItemsOpts {
  meetingId?: string;
  done?: boolean;
  limit: number;
}

/**
 * The data surface the MCP tools depend on. Implemented over Drizzle in `queries.ts`, and
 * faked in tests so tool dispatch + formatting + scope gating are unit-testable without a DB.
 * Every method is scoped to `userId` — the MCP server never serves cross-owner data.
 */
export interface MeetingQueries {
  searchMeetings(userId: string, opts: SearchMeetingsOpts): Promise<MeetingRow[]>;
  getMeeting(userId: string, meetingId: string): Promise<MeetingRow | null>;
  getTranscript(
    userId: string,
    meetingId: string,
  ): Promise<{ transcript: TranscriptRow; segments: TranscriptSegmentRow[] } | null>;
  getSummary(userId: string, meetingId: string): Promise<SummaryRow | null>;
  listActionItems(userId: string, opts: ListActionItemsOpts): Promise<ActionItemRow[]>;
  /** Returns true if an owned action item was updated, false if none matched. */
  updateActionItem(userId: string, actionItemId: string, done: boolean): Promise<boolean>;
}
