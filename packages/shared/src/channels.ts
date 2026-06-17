/**
 * Redis Pub/Sub channel names for a meeting's live stream. Shared by the worker (publisher) and the
 * web SSE route (subscriber) so the names can never drift apart.
 */
export function meetingStatusChannel(meetingId: string): string {
  return `meeting:${meetingId}:status`;
}

export function meetingTranscriptChannel(meetingId: string): string {
  return `meeting:${meetingId}:transcript`;
}
