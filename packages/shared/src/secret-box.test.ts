import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, generateEncryptionKeyHex } from './secret-box';

const KEY = '0'.repeat(64); // 32 bytes of zeros, hex

describe('secret-box', () => {
  it('round-trips a secret', () => {
    const blob = encryptSecret('hunter2', KEY);
    expect(blob.startsWith('v1.')).toBe(true);
    expect(decryptSecret(blob, KEY)).toBe('hunter2');
  });

  it('produces a distinct ciphertext each time (random IV)', () => {
    expect(encryptSecret('x', KEY)).not.toBe(encryptSecret('x', KEY));
  });

  it('fails to decrypt with the wrong key', () => {
    const blob = encryptSecret('secret', KEY);
    expect(() => decryptSecret(blob, 'f'.repeat(64))).toThrow();
  });

  it('fails on tampered ciphertext (GCM auth)', () => {
    const blob = encryptSecret('secret', KEY);
    const parts = blob.split('.');
    const tampered = [parts[0], parts[1], parts[2], Buffer.from('evil').toString('base64')].join(
      '.',
    );
    expect(() => decryptSecret(tampered, KEY)).toThrow();
  });

  it('rejects a non-32-byte key', () => {
    expect(() => encryptSecret('x', 'abcd')).toThrow(/32 bytes/);
  });

  it('rejects a malformed blob', () => {
    expect(() => decryptSecret('garbage', KEY)).toThrow(/Malformed/);
  });

  it('generates a 64-hex-char key', () => {
    expect(generateEncryptionKeyHex()).toMatch(/^[0-9a-f]{64}$/);
  });
});
