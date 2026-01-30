'use strict';

const {
  validateTTL,
  validateMaxViews,
  validateCiphertext,
  validateIV,
  validateSalt,
  validateNonce,
  validateSecretId,
  validateBurnToken,
  validateAccessToken,
  validateCreateSecretRequest,
  TTL_MIN,
  TTL_MAX,
  MAX_VIEWS_MIN,
  MAX_VIEWS_MAX,
  MAX_CIPHERTEXT_BYTES,
  IV_BYTES,
  SALT_BYTES,
  NONCE_BYTES,
  _internal
} = require('./validation');

describe('validation.js', () => {
  describe('validateTTL', () => {
    it('should accept valid TTL values', () => {
      expect(validateTTL(900)).toBe(true);      // Minimum (15 min)
      expect(validateTTL(7776000)).toBe(true);  // Maximum (90 days)
      expect(validateTTL(86400)).toBe(true);    // 1 day
      expect(validateTTL(3600)).toBe(true);     // 1 hour
    });

    it('should reject TTL below minimum', () => {
      expect(validateTTL(899)).toBe(false);
      expect(validateTTL(0)).toBe(false);
      expect(validateTTL(-1)).toBe(false);
    });

    it('should reject TTL above maximum', () => {
      expect(validateTTL(7776001)).toBe(false);
      expect(validateTTL(10000000)).toBe(false);
    });

    it('should reject non-integer TTL', () => {
      expect(validateTTL(900.5)).toBe(false);
      expect(validateTTL('900')).toBe(false);
      expect(validateTTL(null)).toBe(false);
      expect(validateTTL(undefined)).toBe(false);
    });
  });

  describe('validateMaxViews', () => {
    it('should accept valid maxViews values', () => {
      expect(validateMaxViews(1)).toBe(true);
      expect(validateMaxViews(2)).toBe(true);
      expect(validateMaxViews(3)).toBe(true);
      expect(validateMaxViews(4)).toBe(true);
      expect(validateMaxViews(5)).toBe(true);
    });

    it('should reject maxViews below minimum', () => {
      expect(validateMaxViews(0)).toBe(false);
      expect(validateMaxViews(-1)).toBe(false);
    });

    it('should reject maxViews above maximum', () => {
      expect(validateMaxViews(6)).toBe(false);
      expect(validateMaxViews(100)).toBe(false);
    });

    it('should reject non-integer maxViews', () => {
      expect(validateMaxViews(1.5)).toBe(false);
      expect(validateMaxViews('1')).toBe(false);
      expect(validateMaxViews(null)).toBe(false);
    });
  });

  describe('validateCiphertext', () => {
    it('should accept valid base64 ciphertext', () => {
      // Valid base64 within size limit
      const validCiphertext = Buffer.from('hello world encrypted').toString('base64');
      expect(validateCiphertext(validCiphertext)).toBe(true);
    });

    it('should accept ciphertext at max size', () => {
      // Create 68KB of data
      const maxData = Buffer.alloc(MAX_CIPHERTEXT_BYTES, 'x');
      const maxCiphertext = maxData.toString('base64');
      expect(validateCiphertext(maxCiphertext)).toBe(true);
    });

    it('should reject ciphertext over size limit', () => {
      // Create data slightly over limit
      const overData = Buffer.alloc(MAX_CIPHERTEXT_BYTES + 1, 'x');
      const overCiphertext = overData.toString('base64');
      expect(validateCiphertext(overCiphertext)).toBe(false);
    });

    it('should reject invalid base64', () => {
      expect(validateCiphertext('not-valid-base64!!!')).toBe(false);
      expect(validateCiphertext('!!!@@@###')).toBe(false);
    });

    it('should reject empty or non-string', () => {
      expect(validateCiphertext('')).toBe(false);
      expect(validateCiphertext(null)).toBe(false);
      expect(validateCiphertext(undefined)).toBe(false);
      expect(validateCiphertext(123)).toBe(false);
    });
  });

  describe('validateIV', () => {
    it('should accept valid 12-byte IV', () => {
      // 12 bytes = 16 chars base64
      const validIV = Buffer.alloc(12, 0x01).toString('base64');
      expect(validateIV(validIV)).toBe(true);
    });

    it('should reject IV with wrong length', () => {
      // 11 bytes
      const shortIV = Buffer.alloc(11, 0x01).toString('base64');
      expect(validateIV(shortIV)).toBe(false);
      
      // 13 bytes
      const longIV = Buffer.alloc(13, 0x01).toString('base64');
      expect(validateIV(longIV)).toBe(false);
    });

    it('should reject invalid base64', () => {
      expect(validateIV('not-base64!!!')).toBe(false);
    });

    it('should reject empty or non-string', () => {
      expect(validateIV('')).toBe(false);
      expect(validateIV(null)).toBe(false);
      expect(validateIV(undefined)).toBe(false);
    });
  });

  describe('validateSalt', () => {
    it('should accept null (non-passphrase-protected)', () => {
      expect(validateSalt(null)).toBe(true);
    });

    it('should accept valid 16-byte salt', () => {
      // 16 bytes = 24 chars base64
      const validSalt = Buffer.alloc(16, 0x01).toString('base64');
      expect(validateSalt(validSalt)).toBe(true);
    });

    it('should reject salt with wrong length', () => {
      // 15 bytes
      const shortSalt = Buffer.alloc(15, 0x01).toString('base64');
      expect(validateSalt(shortSalt)).toBe(false);
      
      // 17 bytes
      const longSalt = Buffer.alloc(17, 0x01).toString('base64');
      expect(validateSalt(longSalt)).toBe(false);
    });

    it('should reject invalid base64', () => {
      expect(validateSalt('not-base64!!!')).toBe(false);
    });

    it('should reject non-null non-string', () => {
      expect(validateSalt(undefined)).toBe(false);
      expect(validateSalt(123)).toBe(false);
      expect(validateSalt({})).toBe(false);
    });
  });

  describe('validateNonce', () => {
    it('should accept valid 32-char hex nonce', () => {
      // 16 bytes = 32 hex chars
      const validNonce = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
      expect(validateNonce(validNonce)).toBe(true);
    });

    it('should accept uppercase hex', () => {
      const upperNonce = 'A1B2C3D4E5F67890A1B2C3D4E5F67890';
      expect(validateNonce(upperNonce)).toBe(true);
    });

    it('should reject wrong length', () => {
      expect(validateNonce('a1b2c3d4')).toBe(false); // Too short
      expect(validateNonce('a1b2c3d4e5f67890a1b2c3d4e5f67890ff')).toBe(false); // Too long
    });

    it('should reject non-hex characters', () => {
      expect(validateNonce('g1b2c3d4e5f67890a1b2c3d4e5f67890')).toBe(false);
      expect(validateNonce('a1b2c3d4e5f67890a1b2c3d4e5f6789!')).toBe(false);
    });

    it('should reject empty or non-string', () => {
      expect(validateNonce('')).toBe(false);
      expect(validateNonce(null)).toBe(false);
      expect(validateNonce(undefined)).toBe(false);
    });
  });

  describe('validateSecretId', () => {
    it('should accept valid 22-char base64url ID', () => {
      const validId = 'Ab3dEf6hIj9kLmNoPqRsT-';
      expect(validateSecretId(validId)).toBe(true);
    });

    it('should accept base64url with underscores', () => {
      const validId = 'Ab3dEf6hIj9kLmNo_qRsT_';
      expect(validateSecretId(validId)).toBe(true);
    });

    it('should reject wrong length', () => {
      expect(validateSecretId('Ab3dEf6hIj9kLmNoPq')).toBe(false); // Too short
      expect(validateSecretId('Ab3dEf6hIj9kLmNoPqRsTuvwx')).toBe(false); // Too long
    });

    it('should reject invalid characters', () => {
      expect(validateSecretId('Ab3dEf6hIj9kLmNoPqRs+=')).toBe(false); // Standard base64
      expect(validateSecretId('Ab3dEf6hIj9kLmNoPqRs!!')).toBe(false);
    });

    it('should reject empty or non-string', () => {
      expect(validateSecretId('')).toBe(false);
      expect(validateSecretId(null)).toBe(false);
      expect(validateSecretId(undefined)).toBe(false);
    });
  });

  describe('validateBurnToken', () => {
    it('should accept valid 32-char hex token', () => {
      const validToken = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
      expect(validateBurnToken(validToken)).toBe(true);
    });

    it('should reject wrong length', () => {
      expect(validateBurnToken('a1b2c3d4')).toBe(false);
      expect(validateBurnToken('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6ff')).toBe(false);
    });

    it('should reject non-hex', () => {
      expect(validateBurnToken('g1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')).toBe(false);
    });

    it('should reject empty or non-string', () => {
      expect(validateBurnToken('')).toBe(false);
      expect(validateBurnToken(null)).toBe(false);
    });
  });

  describe('validateAccessToken', () => {
    it('should accept valid 32-char hex token', () => {
      const validToken = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
      expect(validateAccessToken(validToken)).toBe(true);
    });

    it('should accept empty/null/undefined (optional)', () => {
      expect(validateAccessToken('')).toBe(true);
      expect(validateAccessToken(null)).toBe(true);
      expect(validateAccessToken(undefined)).toBe(true);
    });

    it('should reject invalid token', () => {
      expect(validateAccessToken('short')).toBe(false);
      expect(validateAccessToken('not-hex-at-all-here!!!!!!!!!!!!!')).toBe(false);
    });
  });

  describe('validateCreateSecretRequest', () => {
    const validRequest = {
      ciphertext: Buffer.from('test').toString('base64'),
      iv: Buffer.alloc(12, 0x01).toString('base64'),
      salt: null,
      nonce: 'a1b2c3d4e5f67890a1b2c3d4e5f67890',
      pow: '12345',
      ttl: 86400,
      maxViews: 1,
      passphraseProtected: false
    };

    it('should accept valid request', () => {
      const result = validateCreateSecretRequest(validRequest);
      expect(result.valid).toBe(true);
    });

    it('should accept valid request with salt', () => {
      const request = {
        ...validRequest,
        salt: Buffer.alloc(16, 0x01).toString('base64'),
        passphraseProtected: true
      };
      const result = validateCreateSecretRequest(request);
      expect(result.valid).toBe(true);
    });

    it('should reject null/undefined body', () => {
      expect(validateCreateSecretRequest(null).valid).toBe(false);
      expect(validateCreateSecretRequest(undefined).valid).toBe(false);
    });

    it('should reject missing ciphertext', () => {
      const { ciphertext, ...request } = validRequest;
      const result = validateCreateSecretRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ciphertext');
    });

    it('should reject missing iv', () => {
      const { iv, ...request } = validRequest;
      const result = validateCreateSecretRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('iv');
    });

    it('should reject invalid salt', () => {
      const request = { ...validRequest, salt: 'invalid' };
      const result = validateCreateSecretRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('salt');
    });

    it('should reject missing nonce', () => {
      const { nonce, ...request } = validRequest;
      const result = validateCreateSecretRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('nonce');
    });

    it('should reject missing pow', () => {
      const { pow, ...request } = validRequest;
      const result = validateCreateSecretRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('pow');
    });

    it('should reject invalid ttl', () => {
      const request = { ...validRequest, ttl: 100 };
      const result = validateCreateSecretRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ttl');
    });

    it('should reject invalid maxViews', () => {
      const request = { ...validRequest, maxViews: 10 };
      const result = validateCreateSecretRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('maxViews');
    });

    it('should reject non-boolean passphraseProtected', () => {
      const request = { ...validRequest, passphraseProtected: 'true' };
      const result = validateCreateSecretRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('passphraseProtected');
    });

    it('should reject passphrase protected without salt', () => {
      const request = { ...validRequest, passphraseProtected: true, salt: null };
      const result = validateCreateSecretRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('salt');
    });
  });

  describe('_internal.isValidBase64', () => {
    it('should accept valid base64', () => {
      expect(_internal.isValidBase64('SGVsbG8gV29ybGQ=')).toBe(true);
      expect(_internal.isValidBase64('YWJj')).toBe(true);
    });

    it('should reject invalid base64', () => {
      expect(_internal.isValidBase64('!@#$%')).toBe(false);
      expect(_internal.isValidBase64(null)).toBe(false);
    });
  });

  describe('_internal.isValidHex', () => {
    it('should accept valid hex', () => {
      expect(_internal.isValidHex('0123456789abcdef')).toBe(true);
      expect(_internal.isValidHex('ABCDEF')).toBe(true);
    });

    it('should reject invalid hex', () => {
      expect(_internal.isValidHex('ghij')).toBe(false);
      expect(_internal.isValidHex('!@#$')).toBe(false);
      expect(_internal.isValidHex(null)).toBe(false);
    });
  });

  describe('constants', () => {
    it('should have correct TTL bounds', () => {
      expect(TTL_MIN).toBe(900);      // 15 minutes
      expect(TTL_MAX).toBe(7776000);  // 90 days
    });

    it('should have correct maxViews bounds', () => {
      expect(MAX_VIEWS_MIN).toBe(1);
      expect(MAX_VIEWS_MAX).toBe(5);
    });

    it('should have correct size limits', () => {
      expect(MAX_CIPHERTEXT_BYTES).toBe(68 * 1024);
      expect(IV_BYTES).toBe(12);
      expect(SALT_BYTES).toBe(16);
      expect(NONCE_BYTES).toBe(16);
    });
  });
});
