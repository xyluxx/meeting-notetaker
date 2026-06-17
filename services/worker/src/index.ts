/**
 * Worker entrypoint. One image, roles selected by WORKER_ROLE:
 *   - scheduler    : calendar sync -> delayed join jobs
 *   - vexa-driver  : consume the meetings queue, drive Vexa over REST (POST /bots) + WS consumer
 *   - summarizer   : transcript ingest + OpenRouter summary jobs
 *
 * M0/M1 stand up the process skeleton (Redis connectivity + heartbeat + graceful shutdown).
 * Job processors are added in their milestones (M5 vexa-driver, M6 WS, M7 ingest, M8 summarize).
 */
import { getDb } from '@pmn/db';
import { Redis } from 'ioredis';
import { startScheduler } from './calendar-sync.js';
import { startMaintenance } from './maintenance.js';
import { bullConnectionOptions, redisUrl } from './queues.js';
import { startSummarizer } from './summarizer.js';
import { startTranscriptIngest } from './transcript-ingest.js';
import { startVexaDriver } from './vexa-driver.js';

type WorkerRole = 'scheduler' | 'vexa-driver' | 'summarizer' | 'maintenance';

const VALID_ROLES: readonly WorkerRole[] = [
  'scheduler',
  'vexa-driver',
  'summarizer',
  'maintenance',
];

function resolveRole(): WorkerRole {
  const role = process.env.WORKER_ROLE ?? 'scheduler';
  if (!VALID_ROLES.includes(role as WorkerRole)) {
    throw new Error(`Invalid WORKER_ROLE "${role}". Expected one of: ${VALID_ROLES.join(', ')}`);
  }
  return role as WorkerRole;
}

async function main() {
  const role = resolveRole();
  const connection = new Redis(redisUrl(), bullConnectionOptions);

  connection.on('error', (err) => console.error(`[worker:${role}] redis error:`, err.message));
  await connection.connect().catch(() => {
    /* ioredis lazyConnect is off by default; connect() may already be in-flight */
  });

  console.log(`[worker:${role}] started; redis=${redisUrl()}`);

  // Role-specific processors.
  if (role === 'scheduler') {
    await startScheduler({ db: getDb() });
    console.log('[worker:scheduler] syncing calendars + scheduling joins');
  } else if (role === 'vexa-driver') {
    startVexaDriver({ db: getDb() });
    console.log('[worker:vexa-driver] consuming the meetings dispatch queue');
  } else if (role === 'summarizer') {
    const db = getDb();
    startTranscriptIngest({ db });
    startSummarizer({ db });
    console.log('[worker:summarizer] consuming the transcription + summarize queues');
  } else if (role === 'maintenance') {
    await startMaintenance({ db: getDb() });
    console.log('[worker:maintenance] retention sweeps + notifications');
  }

  // Heartbeat so the container is observably alive until real processors land.
  const heartbeat = setInterval(() => {
    void connection.set(`worker:${role}:heartbeat`, new Date().toISOString(), 'EX', 30);
  }, 10_000);

  const shutdown = async (signal: string) => {
    console.log(`[worker:${role}] received ${signal}, shutting down`);
    clearInterval(heartbeat);
    await connection.quit().catch(() => undefined);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
