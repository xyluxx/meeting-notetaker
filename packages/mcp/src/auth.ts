import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Bearer auth for the MCP server. We reuse the dashboard's API-key scheme
 * (`mbk_<prefix>.<secret>`, SHA-256-hashed, looked up by non-secret prefix) so a single
 * scoped key works for both the REST API and MCP. No OAuth/token-passthrough: the key is
 * minted in the dashboard and validated locally against our own database.
 */

export interface KeyRecord {
  userId: string;
  /** Hex SHA-256 of the full `mbk_<prefix>.<secret>` token. */
  hash: string;
  scopes: string[];
  revokedAt: Date | null;
  expiresAt: Date | null;
}

/** Resolves a non-secret key prefix to its stored record (or null if unknown). */
export type KeyLookup = (prefix: string) => Promise<KeyRecord | null>;

export interface AuthedKey {
  userId: string;
  scopes: string[];
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Parse an `Authorization: Bearer mbk_<prefix>.<secret>` header into its prefix + full token. */
export function parseBearer(
  authHeader: string | null | undefined,
): { prefix: string; token: string } | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1]!.trim();
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  return { prefix: token.slice(0, dot), token };
}

/** Constant-time compare of two hex-encoded digests. */
export function safeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Authenticate a bearer header against the key store. Returns the owning user + scopes, or null.
 * `now` is injectable for deterministic expiry tests.
 */
export async function authenticate(
  authHeader: string | null | undefined,
  lookup: KeyLookup,
  now: () => number = () => Date.now(),
): Promise<AuthedKey | null> {
  const parsed = parseBearer(authHeader);
  if (!parsed) return null;
  const record = await lookup(parsed.prefix);
  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt.getTime() < now()) return null;
  if (!safeEqualHex(record.hash, sha256Hex(parsed.token))) return null;
  return { userId: record.userId, scopes: record.scopes };
}
