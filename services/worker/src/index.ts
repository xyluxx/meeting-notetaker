/**
 * Worker entrypoint. One image, three roles selected by WORKER_ROLE:
 *   - scheduler    : calendar sync -> delayed join jobs, watch-channel re-arm
 *   - bot-manager  : consume the meetings queue, spawn/monitor/reap bot containers
 *   - summarizer   : transcription + OpenRouter summary jobs
 *
 * M0 stands up the process skeleton (Redis connectivity + heartbeat + graceful shutdown).
 * Job processors are added in their respective milestones (M3/M5/M6/M8).
 */
import { Redis } from 'ioredis';
import { bullConnectionOptions, redisUrl } from './queues.js';

type WorkerRole = 'scheduler' | 'bot-manager' | 'summarizer';

const VALID_ROLES: readonly WorkerRole[] = ['scheduler', 'bot-manager', 'summarizer'];

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
