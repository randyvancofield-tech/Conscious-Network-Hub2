import crypto from 'crypto';
import { hashPassword, verifyPassword } from '../auth';

describe('password verification hardening', () => {
  it('accepts supported password hashes and rejects plaintext stored passwords', () => {
    const password = 'LaunchPassphrase123!';
    const legacySha256 = crypto.createHash('sha256').update(password).digest('hex');

    expect(verifyPassword(password, hashPassword(password))).toBe(true);
    expect(verifyPassword(password, legacySha256)).toBe(true);
    expect(verifyPassword(password, password)).toBe(false);
  });
});
