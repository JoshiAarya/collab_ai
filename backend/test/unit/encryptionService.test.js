import { describe, it, expect } from 'vitest';
import EncryptionService from '../../src/core/stability/EncryptionService.js';

describe('EncryptionService', () => {
  it('round-trips a value through encrypt/decrypt', () => {
    const secret = 'sk-test-api-key-12345';
    const encrypted = EncryptionService.encrypt(secret);
    expect(encrypted).not.toBe(secret);
    expect(EncryptionService.decrypt(encrypted)).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = EncryptionService.encrypt('same-value');
    const b = EncryptionService.encrypt('same-value');
    expect(a).not.toBe(b);
  });

  it('recognizes its own ciphertext format', () => {
    const encrypted = EncryptionService.encrypt('value');
    expect(EncryptionService.isEncrypted(encrypted)).toBe(true);
    expect(EncryptionService.isEncrypted('plaintext-key')).toBe(false);
    expect(EncryptionService.isEncrypted('')).toBe(false);
    expect(EncryptionService.isEncrypted(null)).toBe(false);
  });

  it('encryptIfNeeded is idempotent', () => {
    const once = EncryptionService.encryptIfNeeded('plain-key');
    const twice = EncryptionService.encryptIfNeeded(once);
    expect(twice).toBe(once);
    expect(EncryptionService.decryptForUse(twice)).toBe('plain-key');
  });

  it('decryptForUse passes plaintext through (legacy compatibility)', () => {
    expect(EncryptionService.decryptForUse('legacy-plain-key')).toBe('legacy-plain-key');
  });

  it('rejects tampered ciphertext (GCM auth)', () => {
    const encrypted = EncryptionService.encrypt('value');
    const parts = encrypted.split(':');
    const tampered = parts[0] + ':' + parts[1] + ':' + parts[2].replace(/^./, c => (c === '0' ? '1' : '0'));
    expect(() => EncryptionService.decrypt(tampered)).toThrow();
  });
});
