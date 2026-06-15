import 'server-only';
import { headers } from 'next/headers';
import { auth } from './auth';

/** Current Better Auth session ({ user, session }) or null. */
export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}
