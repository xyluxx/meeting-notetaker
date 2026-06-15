import { count, schema } from '@pmn/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';

/**
 * Better Auth (email + password, DB sessions). Single-owner app: the first sign-up creates the owner;
 * a create hook blocks any subsequent sign-up. uuid PKs are DB-generated (generateId: false).
 */
export const auth = betterAuth({
  appName: 'NoteTaker',
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  advanced: {
    database: { generateId: false },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          const [row] = await db.select({ n: count() }).from(schema.users);
          if ((row?.n ?? 0) > 0) {
            throw new Error(
              'An owner already exists. Sign-up is disabled for this single-user app.',
            );
          }
        },
      },
    },
  },
});

/** True once the owner account exists (used to gate onboarding vs login). */
export async function ownerExists(): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(schema.users);
  return (row?.n ?? 0) > 0;
}
