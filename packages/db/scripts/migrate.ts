/**
 * Apply pending Drizzle migrations against DATABASE_URL. Run via `pnpm db:migrate`.
 * Uses a dedicated single connection so it can run as a one-shot in CI or compose init.
 */
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const migrationClient = postgres(url, { max: 1 });
  const db = drizzle(migrationClient);

  const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder });
  console.log('Migrations complete.');

  await migrationClient.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
