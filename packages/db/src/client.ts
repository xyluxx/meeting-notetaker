import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = ReturnType<typeof createDb>;

/** Create a Drizzle client bound to the given connection string. */
export function createDb(connectionString: string, options?: { max?: number }) {
  const client = postgres(connectionString, {
    max: options?.max ?? 10,
    // snake_case in DB, camelCase in TS — handled by drizzle `casing` option below.
  });
  return drizzle(client, { schema, casing: 'snake_case' });
}

let singleton: Database | undefined;

/**
 * Lazily-created shared client using DATABASE_URL. Use in long-lived processes (web, worker).
 * Throws if DATABASE_URL is unset so misconfiguration fails fast.
 */
export function getDb(): Database {
  if (!singleton) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    singleton = createDb(url);
  }
  return singleton;
}
