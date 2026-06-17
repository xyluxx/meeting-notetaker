import { describe, expect, it } from 'vitest';
import { type KeyRecord, authenticate, parseBearer, safeEqualHex, sha256Hex } from './auth';

const TOKEN = 'mbk_abc123def456.deadbeefcafebabe0123456789abcdef';
const PREFIX = 'mbk_abc123def456';

function record(over: Partial<KeyRecord> = {}): KeyRecord {
  return {
    userId: 'user-1',
    hash: sha256Hex(TOKEN),
    scopes: ['meetings:read'],
    revokedAt: null,
    expiresAt: null,
    ...over,
  };
}

describe('parseBearer', () => {
  it('extracts prefix and full token', () => {
    expect(parseBearer(`Bearer ${TOKEN}`)).toEqual({ prefix: PREFIX, token: TOKEN });
  });

  it('is case-insensitive on the scheme', () => {
    expect(parseBearer(`bearer ${TOKEN}`)?.prefix).toBe(PREFIX);
  });

  it('rejects missing header, wrong scheme, and dot-less tokens', () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer('Basic xyz')).toBeNull();
    expect(parseBearer('Bearer nodotshere')).toBeNull();
    expect(parseBearer('Bearer .leadingdot')).toBeNull();
    expect(parseBearer('Bearer trailingdot.')).toBeNull();
  });
});

describe('safeEqualHex', () => {
  it('matches identical digests and rejects mismatched/empty', () => {
    const h = sha256Hex('x');
    expect(safeEqualHex(h, h)).toBe(true);
    expect(safeEqualHex(h, sha256Hex('y'))).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
  });
});

describe('authenticate', () => {
  const lookup = (rec: KeyRecord | null) => async () => rec;

  it('returns user + scopes for a valid key', async () => {
    const authed = await authenticate(`Bearer ${TOKEN}`, lookup(record()));
    expect(authed).toEqual({ userId: 'user-1', scopes: ['meetings:read'] });
  });

  it('rejects an unknown prefix', async () => {
    expect(await authenticate(`Bearer ${TOKEN}`, lookup(null))).toBeNull();
  });

  it('rejects a wrong secret (hash mismatch)', async () => {
    const rec = record({ hash: sha256Hex('mbk_abc123def456.wrong') });
    expect(await authenticate(`Bearer ${TOKEN}`, lookup(rec))).toBeNull();
  });

  it('rejects revoked keys', async () => {
    const rec = record({ revokedAt: new Date('2020-01-01') });
    expect(await authenticate(`Bearer ${TOKEN}`, lookup(rec))).toBeNull();
  });

  it('rejects expired keys but accepts not-yet-expired ones', async () => {
    const now = () => new Date('2026-06-16T00:00:00Z').getTime();
    const expired = record({ expiresAt: new Date('2026-01-01T00:00:00Z') });
    const valid = record({ expiresAt: new Date('2027-01-01T00:00:00Z') });
    expect(await authenticate(`Bearer ${TOKEN}`, lookup(expired), now)).toBeNull();
    expect(await authenticate(`Bearer ${TOKEN}`, lookup(valid), now)).not.toBeNull();
  });
});
