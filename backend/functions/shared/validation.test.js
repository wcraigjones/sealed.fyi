import {
  validateTTL,
  validateMaxViews,
  validateCiphertext,
  validateIV,
  validateSalt,
  validateNonce,
  validateSecretId,
  validateBurnToken
} from './validation.js';

describe('Input validation', () => {
  describe('validateTTL', () => {
    test('accepts minimum value (900)', () => {
      expect(validateTTL(900)).toBe(true);
    });

    test('accepts maximum value (7776000)', () => {
      expect(validateTTL(7776000)).toBe(true);
    });

    test('accepts values in range', () => {
      expect(validateTTL(3600)).toBe(true);     // 1 hour
      expect(validateTTL(86400)).toBe(true);    // 1 day
      expect(validateTTL(604800)).toBe(true);   // 7 days
      expect(validateTTL(2592000)).toBe(true);  // 30 days
    });

    test('rejects below minimum (899)', () => {
      expect(validateTTL(899)).toBe(false);
    });

    test('rejects above maximum (7776001)', () => {
      expect(validateTTL(7776001)).toBe(false);
    });

    test('rejects negative values', () => {
      expect(validateTTL(-1)).toBe(false);
      expect(validateTTL(-900)).toBe(false);
    });

    test('rejects zero', () => {
      expect(validateTTL(0)).toBe(false);
    });

    test('rejects non-integers', () => {
      expect(validateTTL(900.5)).toBe(false);
      expect(validateTTL(3600.1)).toBe(false);
    });

    test('rejects non-numbers', () => {
      expect(validateTTL('900')).toBe(false);
      expect(validateTTL(null)).toBe(false);
      expect(validateTTL(undefined)).toBe(false);
      expect(validateTTL({})).toBe(false);
    });
  });

  describe('validateMaxViews', () => {
    test('accepts 1', () => {
      expect(validateMaxViews(1)).toBe(true);
    });

    test('accepts 5', () => {
      expect(validateMaxViews(5)).toBe(true);
    });

    test('accepts values 2, 3, 4', () => {
      expect(validateMaxViews(2)).toBe(true);
      expect(validateMaxViews(3)).toBe(true);
      expect(validateMaxViews(4)).toBe(true);
    });

    test('rejects 0', () => {
      expect(validateMaxViews(0)).toBe(false);
    });

    test('rejects 6', () => {
      expect(validateMaxViews(6)).toBe(false);
    });

    test('rejects negative values', () => {
      expect(validateMaxViews(-1)).toBe(false);
    });

    test('rejects non-integers', () => {
      expect(validateMaxViews(1.5)).toBe(false);
      expect(validateMaxViews(3.14)).toBe(false);
    });

    test('rejects non-numbers', () => {
      expect(validateMaxViews('1')).toBe(false);
      expect(validateMaxViews(null)).toBe(false);
      expect(validateMaxViews(undefined)).toBe(false);
    });
  });

  describe('validateCiphertext', () => {
    test('accepts valid base64', () => {
      // Simple valid base64
      expect(validateCiphertext('SGVsbG8gV29ybGQh')).toBe(true);
    });

    test('accepts valid base64 with padding', () => {
      expect(validateCiphertext('SGVsbG8=')).toBe(true);
      expect(validateCiphertext('SGVsbG9X')).toBe(true);
    });

    test('accepts payload at size limit', () => {
      // Create a base64 string that decodes to just under 68KB
      const bytes = 68 * 1024 - 100;
      const encoded = Buffer.alloc(bytes).toString('base64');
      expect(validateCiphertext(encoded)).toBe(true);
    });

    test('rejects oversized payload', () => {
      // Create a base64 string that decodes to over 68KB
      const bytes = 70 * 1024;
      const encoded = Buffer.alloc(bytes).toString('base64');
      expect(validateCiphertext(encoded)).toBe(false);
    });

    test('rejects invalid base64 characters', () => {
      expect(validateCiphertext('SGVsbG8!V29ybGQ=')).toBe(false);
      expect(validateCiphertext('SGVs bG8=')).toBe(false);
    });

    test('rejects empty string', () => {
      expect(validateCiphertext('')).toBe(false);
    });

    test('rejects non-strings', () => {
      expect(validateCiphertext(null)).toBe(false);
      expect(validateCiphertext(undefined)).toBe(false);
      expect(validateCiphertext(123)).toBe(false);
    });
  });

  describe('validateIV', () => {
    test('accepts valid 12-byte IV', () => {
      // 12 bytes = 16 base64 chars
      const iv = Buffer.alloc(12, 0xff).toString('base64');
      expect(validateIV(iv)).toBe(true);
    });

    test('rejects 11-byte IV', () => {
      const iv = Buffer.alloc(11, 0xff).toString('base64');
      expect(validateIV(iv)).toBe(false);
    });

    test('rejects 13-byte IV', () => {
      const iv = Buffer.alloc(13, 0xff).toString('base64');
      expect(validateIV(iv)).toBe(false);
    });

    test('rejects invalid base64', () => {
      expect(validateIV('invalid!base64')).toBe(false);
    });

    test('rejects empty string', () => {
      expect(validateIV('')).toBe(false);
    });

    test('rejects non-strings', () => {
      expect(validateIV(null)).toBe(false);
      expect(validateIV(undefined)).toBe(false);
    });
  });

  describe('validateSalt', () => {
    test('accepts null', () => {
      expect(validateSalt(null)).toBe(true);
    });

    test('accepts valid 16-byte salt', () => {
      // 16 bytes = 24 base64 chars (with padding)
      const salt = Buffer.alloc(16, 0xff).toString('base64');
      expect(validateSalt(salt)).toBe(true);
    });

    test('rejects 15-byte salt', () => {
      const salt = Buffer.alloc(15, 0xff).toString('base64');
      expect(validateSalt(salt)).toBe(false);
    });

    test('rejects 17-byte salt', () => {
      const salt = Buffer.alloc(17, 0xff).toString('base64');
      expect(validateSalt(salt)).toBe(false);
    });

    test('rejects invalid base64', () => {
      expect(validateSalt('invalid!base64==')).toBe(false);
    });

    test('rejects empty string', () => {
      expect(validateSalt('')).toBe(false);
    });

    test('rejects undefined', () => {
      expect(validateSalt(undefined)).toBe(false);
    });
  });

  describe('validateNonce', () => {
    test('accepts valid 32-char hex nonce', () => {
      expect(validateNonce('a1b2c3d4e5f67890a1b2c3d4e5f67890')).toBe(true);
      expect(validateNonce('0000000000000000ffffffffffffffff')).toBe(true);
      expect(validateNonce('AABBCCDD11223344AABBCCDD11223344')).toBe(true);
    });

    test('rejects 31-char nonce', () => {
      expect(validateNonce('a1b2c3d4e5f67890a1b2c3d4e5f6789')).toBe(false);
    });

    test('rejects 33-char nonce', () => {
      expect(validateNonce('a1b2c3d4e5f67890a1b2c3d4e5f678901')).toBe(false);
    });

    test('rejects non-hex characters', () => {
      expect(validateNonce('g1b2c3d4e5f67890a1b2c3d4e5f67890')).toBe(false);
      expect(validateNonce('a1b2c3d4e5f67890a1b2c3d4e5f6789z')).toBe(false);
    });

    test('rejects empty string', () => {
      expect(validateNonce('')).toBe(false);
    });

    test('rejects non-strings', () => {
      expect(validateNonce(null)).toBe(false);
      expect(validateNonce(undefined)).toBe(false);
      expect(validateNonce(123)).toBe(false);
    });
  });

  describe('validateSecretId', () => {
    test('accepts valid 22-char base64url ID', () => {
      expect(validateSecretId('Ab3dEf6hIj9kLmNoPqRsT1')).toBe(true);
      expect(validateSecretId('0123456789ABCDEFabcdef')).toBe(true);
      expect(validateSecretId('aaaa_bbb-ccc_ddd-eeeff')).toBe(true);
    });

    test('rejects 21-char ID', () => {
      expect(validateSecretId('Ab3dEf6hIj9kLmNoPqRsT')).toBe(false);
    });

    test('rejects 23-char ID', () => {
      expect(validateSecretId('Ab3dEf6hIj9kLmNoPqRsT12')).toBe(false);
    });

    test('rejects non-base64url characters', () => {
      expect(validateSecretId('Ab3dEf6hIj9kLmNoPqRs+/')).toBe(false);
      expect(validateSecretId('Ab3dEf6hIj9kLmNoPqRs==')).toBe(false);
    });

    test('rejects empty string', () => {
      expect(validateSecretId('')).toBe(false);
    });

    test('rejects non-strings', () => {
      expect(validateSecretId(null)).toBe(false);
      expect(validateSecretId(undefined)).toBe(false);
      expect(validateSecretId(12345678901234567890)).toBe(false);
    });
  });

  describe('validateBurnToken', () => {
    test('accepts valid 32-char hex token', () => {
      expect(validateBurnToken('a1b2c3d4e5f67890a1b2c3d4e5f67890')).toBe(true);
      expect(validateBurnToken('00000000000000000000000000000000')).toBe(true);
      expect(validateBurnToken('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toBe(true);
    });

    test('rejects 31-char token', () => {
      expect(validateBurnToken('a1b2c3d4e5f67890a1b2c3d4e5f6789')).toBe(false);
    });

    test('rejects 33-char token', () => {
      expect(validateBurnToken('a1b2c3d4e5f67890a1b2c3d4e5f678901')).toBe(false);
    });

    test('rejects non-hex characters', () => {
      expect(validateBurnToken('g1b2c3d4e5f67890a1b2c3d4e5f67890')).toBe(false);
      expect(validateBurnToken('a1b2c3d4e5f67890a1b2c3d4e5f6789g')).toBe(false);
    });

    test('rejects empty string', () => {
      expect(validateBurnToken('')).toBe(false);
    });

    test('rejects non-strings', () => {
      expect(validateBurnToken(null)).toBe(false);
      expect(validateBurnToken(undefined)).toBe(false);
    });
  });
});
