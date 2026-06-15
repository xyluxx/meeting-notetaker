import { getDb } from '@pmn/db';

/** Shared Drizzle client for the web app (singleton via @pmn/db). */
export const db = getDb();
