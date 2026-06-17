import 'server-only';
import { Queue } from 'bullmq';

/** BullMQ connection options parsed from REDIS_URL (options, not an instance — see worker/queues.ts). */
function connection() {
  const u = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return { host: u.hostname, port: Number(u.port || 6379), maxRetriesPerRequest: null };
}

let meetingsQueueSingleton: Queue | undefined;

/** Producer for the `meetings` dispatch queue consumed by the worker's vexa-driver role. */
export function meetingsQueue(): Queue {
  if (!meetingsQueueSingleton) {
    meetingsQueueSingleton = new Queue('meetings', { connection: connection() });
  }
  return meetingsQueueSingleton;
}
