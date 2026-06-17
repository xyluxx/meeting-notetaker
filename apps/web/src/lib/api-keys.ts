import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull, schema } from '@pmn/db';
import { type ApiScope, hasAllScopes } from '@pmn/shared';
import { db } from './db';

/**
 * Opaque, prefixed API keys (`mbk_<prefix>.<secret>`). Only a SHA-256 hash of the full key is stored;
 * the plaintext is shown once on creation. The non-secret `prefix` is the lookup index.
 */
const KEY_PREFIX = 'mbk';

export interface CreatedKey {
  id: string;
  /** Full plaintext — returned ONCE, never stored. */
  key: string;
  prefix: string;
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export async function createApiKey(
  userId: string,
  name: string,
  scopes: ApiScope[],
): Promise<CreatedKey> {
  const prefix = `${KEY_PREFIX}_${randomBytes(6).toString('hex')}`; // 12 hex chars
  const secret = randomBytes(24).toString('hex');
  const key = `${prefix}.${secret}`;
  const [row] = await db
    .insert(schema.apiKeys)
    .values({ userId, name, prefix, hash: sha256(key), scopes })
    .returning({ id: schema.apiKeys.id });
  return { id: row!.id, key, prefix };
}

export async function listApiKeys(userId: string) {
  return db
    .select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      prefix: schema.apiKeys.prefix,
      scopes: schema.apiKeys.scopes,
      lastUsedAt: schema.apiKeys.lastUsedAt,
      revokedAt: schema.apiKeys.revokedAt,
      createdAt: schema.apiKeys.createdAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.userId, userId));
}

export async function revokeApiKey(userId: string, id: string): Promise<void> {
  await db
    .update(schema.apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.userId, userId)));
}

export interface AuthedKey {
  userId: string;
  scopes: string[];
}

/**
 * Verify a `Authorization: Bearer mbk_<prefix>.<secret>` header. Returns the owning user + scopes,
 * or null. Updates last_used_at on success. Constant-time hash compare.
 */
export async function verifyApiKey(authHeader: string | null): Promise<AuthedKey | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const prefix = token.slice(0, dot);

  const [row] = await db
    .select()
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.prefix, prefix), isNull(schema.apiKeys.revokedAt)))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  const expected = Buffer.from(row.hash, 'hex');
  const actual = Buffer.from(sha256(token), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  await db
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, row.id));
  return { userId: row.userId, scopes: row.scopes };
}

/** Authenticate + authorize an API request. Returns the user or a 401/403 Response. */
export async function authorizeApiRequest(
  req: Request,
  required: ApiScope[],
): Promise<AuthedKey | Response> {
  const authed = await verifyApiKey(req.headers.get('authorization'));
  if (!authed) {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Invalid API key' } },
      { status: 401 },
    );
  }
  if (!hasAllScopes(authed.scopes, required)) {
    return Response.json(
      { error: { code: 'insufficient_scope', message: `Requires: ${required.join(', ')}` } },
      { status: 403 },
    );
  }
  return authed;
}
