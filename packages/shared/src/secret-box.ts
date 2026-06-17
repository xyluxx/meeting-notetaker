import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM envelope for secrets at rest (CalDAV passwords, Vexa API key). Format:
 * `v1.<iv b64>.<tag b64>.<ciphertext b64>`. The key is a 32-byte value supplied as 64 hex chars
 * via `MASTER_ENCRYPTION_KEY` (kept out of the DB). Authenticated: tampering fails decryption.
 */
const ALGO = 'aes-256-gcm';
const VERSION = 'v1';

function keyBuffer(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes encoded as 64 hex characters.');
  }
  return key;
}

export function encryptSecret(plaintext: string, keyHex: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBuffer(keyHex), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

export function decryptSecret(blob: string, keyHex: string): string {
  const parts = blob.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Malformed encrypted secret.');
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(ALGO, keyBuffer(keyHex), Buffer.from(ivB64!, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64!, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64!, 'base64')), decipher.final()]).toString(
    'utf8',
  );
}

/** Generate a fresh 64-hex-char key (for `MASTER_ENCRYPTION_KEY` provisioning / docs). */
export function generateEncryptionKeyHex(): string {
  return randomBytes(32).toString('hex');
}
