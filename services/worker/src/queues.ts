/** Canonical BullMQ queue names + the shared Redis connection options. */
export const QUEUE = {
  /** Delayed "join this meeting" jobs fired at start-minus-lead. */
  meetings: 'meetings',
  /** Post-call: download recording, run STT. */
  transcription: 'transcription',
  /** After transcript: OpenRouter summary + action items. */
  summarize: 'summarize',
  /** Periodic calendar re-sync + watch-channel re-arm. */
  calendarSync: 'calendar-sync',
  /** Retention sweeps + notification delivery. */
  maintenance: 'maintenance',
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

/** Redis Pub/Sub channel for a meeting's live status (fanned out to dashboard via SSE). */
export function meetingStatusChannel(meetingId: string): string {
  return `meeting:${meetingId}:status`;
}

export function redisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379';
}

/** BullMQ requires `maxRetriesPerRequest: null` on the shared ioredis connection. */
export const bullConnectionOptions = {
  maxRetriesPerRequest: null,
} as const;
