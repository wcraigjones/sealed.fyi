'use strict';

const {
  generateToken,
  validateToken,
  generateNonce,
  generateSecretId,
  generateBurnToken,
  generateAccessToken,
  generateChallenge,
  extractBearerToken,
  TOKEN_TTL_SECONDS,
  DEFAULT_POW_DIFFICULTY,
  POW_PREFIX,
  _internal
} = require('./token');

describe('token.js', () => {
  const TEST_JWT_SECRET = 'test-secret-for-jwt-signing-12345';
  
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  describe('generateNonce', () => {
    it('should generate a 32-character hex string', () => {
      const nonce = generateNonce();
      
      expect(nonce).toHaveLength(32);
      expect(/^[a-f0-9]+$/.test(nonce)).toBe(true);
    });

    it('should generate unique values', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('generateSecretId', () => {
    it('should generate a 22-character base64url string', () => {
      const id = generateSecretId();
      
      expect(id).toHaveLength(22);
      expect(/^[A-Za-z0-9_-]+$/.test(id)).toBe(true);
    });

    it('should generate unique values', () => {
      const id1 = generateSecretId();
      const id2 = generateSecretId();
      
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateBurnToken', () => {
    it('should generate a 32-character hex string', () => {
      const token = generateBurnToken();
      
      expect(token).toHaveLength(32);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it('should generate unique values', () => {
      const token1 = generateBurnToken();
      const token2 = generateBurnToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a 32-character hex string', () => {
      const token = generateAccessToken();
      
      expect(token).toHaveLength(32);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it('should generate unique values', () => {
      const token1 = generateAccessToken();
      const token2 = generateAccessToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateChallenge', () => {
    it('should return default challenge parameters', () => {
      const challenge = generateChallenge();
      
      expect(challenge).toEqual({
        difficulty: DEFAULT_POW_DIFFICULTY,
        prefix: POW_PREFIX
      });
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT', () => {
      const nonce = generateNonce();
      const challenge = generateChallenge();
      
      const token = generateToken(nonce, challenge);
      
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT structure
    });

    it('should include correct claims', () => {
      const nonce = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
      const challenge = { difficulty: 18, prefix: 'sealed:' };
      
      const token = generateToken(nonce, challenge);
      const payload = validateToken(token);
      
      expect(payload.nonce).toBe(nonce);
      expect(payload.pow_difficulty).toBe(18);
      expect(payload.pow_prefix).toBe('sealed:');
      expect(payload.op).toBe('create');
      expect(payload.jti).toBeDefined();
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBe(payload.iat + TOKEN_TTL_SECONDS);
    });

    it('should throw when JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;
      
      expect(() => generateToken('nonce', { difficulty: 18, prefix: 'sealed:' }))
        .toThrow('JWT_SECRET environment variable is not set');
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', () => {
      const nonce = generateNonce();
      const challenge = generateChallenge();
      const token = generateToken(nonce, challenge);
      
      const payload = validateToken(token);
      
      expect(payload).not.toBeNull();
      expect(payload.nonce).toBe(nonce);
    });

    it('should return null for invalid token', () => {
      expect(validateToken('invalid-token')).toBeNull();
    });

    it('should return null for expired token', () => {
      // Create token with past expiration
      const jwt = require('jsonwebtoken');
      const pastToken = jwt.sign(
        {
          jti: 'test-id',
          iat: Math.floor(Date.now() / 1000) - 600,
          exp: Math.floor(Date.now() / 1000) - 300,
          op: 'create',
          nonce: 'test-nonce',
          pow_difficulty: 18,
          pow_prefix: 'sealed:'
        },
        TEST_JWT_SECRET,
        { algorithm: 'HS256' }
      );
      
      expect(validateToken(pastToken)).toBeNull();
    });

    it('should return null for token with wrong secret', () => {
      const jwt = require('jsonwebtoken');
      const tokenWithWrongSecret = jwt.sign(
        {
          jti: 'test-id',
          op: 'create',
          nonce: 'test-nonce',
          pow_difficulty: 18,
          pow_prefix: 'sealed:'
        },
        'wrong-secret',
        { algorithm: 'HS256', expiresIn: '5m' }
      );
      
      expect(validateToken(tokenWithWrongSecret)).toBeNull();
    });

    it('should return null for token missing required claims', () => {
      const jwt = require('jsonwebtoken');
      const incompleteToken = jwt.sign(
        {
          jti: 'test-id',
          op: 'create'
          // Missing nonce, pow_difficulty, pow_prefix
        },
        TEST_JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '5m' }
      );
      
      expect(validateToken(incompleteToken)).toBeNull();
    });

    it('should return null for wrong operation type', () => {
      const jwt = require('jsonwebtoken');
      const wrongOpToken = jwt.sign(
        {
          jti: 'test-id',
          op: 'delete', // Wrong operation
          nonce: 'test-nonce',
          pow_difficulty: 18,
          pow_prefix: 'sealed:'
        },
        TEST_JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '5m' }
      );
      
      expect(validateToken(wrongOpToken)).toBeNull();
    });

    it('should return null for null/undefined input', () => {
      expect(validateToken(null)).toBeNull();
      expect(validateToken(undefined)).toBeNull();
      expect(validateToken('')).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(validateToken(123)).toBeNull();
      expect(validateToken({})).toBeNull();
      expect(validateToken([])).toBeNull();
    });
  });

  describe('extractBearerToken', () => {
    it('should extract token from valid Bearer header', () => {
      const token = extractBearerToken('Bearer abc123xyz');
      
      expect(token).toBe('abc123xyz');
    });

    it('should be case-insensitive for Bearer prefix', () => {
      const token = extractBearerToken('bearer abc123xyz');
      
      expect(token).toBe('abc123xyz');
    });

    it('should return null for missing header', () => {
      expect(extractBearerToken(null)).toBeNull();
      expect(extractBearerToken(undefined)).toBeNull();
      expect(extractBearerToken('')).toBeNull();
    });

    it('should return null for non-Bearer format', () => {
      expect(extractBearerToken('Basic abc123')).toBeNull();
      expect(extractBearerToken('abc123')).toBeNull();
    });

    it('should return null for malformed Bearer header', () => {
      expect(extractBearerToken('Bearer')).toBeNull();
      expect(extractBearerToken('Bearer ')).toBeNull();
      expect(extractBearerToken('Bearer a b c')).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(extractBearerToken(123)).toBeNull();
      expect(extractBearerToken({})).toBeNull();
    });
  });

  describe('constants', () => {
    it('should have correct TOKEN_TTL_SECONDS', () => {
      expect(TOKEN_TTL_SECONDS).toBe(300); // 5 minutes
    });

    it('should have correct DEFAULT_POW_DIFFICULTY', () => {
      expect(DEFAULT_POW_DIFFICULTY).toBe(18);
    });

    it('should have correct POW_PREFIX', () => {
      expect(POW_PREFIX).toBe('sealed:');
    });
  });
});
