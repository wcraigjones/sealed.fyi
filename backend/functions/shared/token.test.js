import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import {
  generateToken,
  validateToken,
  generateNonce,
  generateSecretId,
  generateBurnToken,
  generateAccessToken
} from './token.js';

describe('Token helpers', () => {
  const TEST_SECRET = 'test-jwt-secret-for-testing';
  
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  describe('generateToken', () => {
    test('creates valid JWT', () => {
      const nonce = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
      const challenge = { difficulty: 18, prefix: 'sealed:' };
      
      const token = generateToken(nonce, challenge);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Verify it's a valid JWT
      const decoded = jwt.verify(token, TEST_SECRET);
      expect(decoded).toBeDefined();
    });

    test('JWT contains required claims', () => {
      const nonce = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
      const challenge = { difficulty: 18, prefix: 'sealed:' };
      
      const token = generateToken(nonce, challenge);
      const decoded = jwt.decode(token);
      
      expect(decoded.jti).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.op).toBe('create');
      expect(decoded.nonce).toBe(nonce);
      expect(decoded.pow_difficulty).toBe(18);
      expect(decoded.pow_prefix).toBe('sealed:');
    });

    test('JWT expires in 5 minutes', () => {
      const nonce = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
      const challenge = { difficulty: 18, prefix: 'sealed:' };
      
      const token = generateToken(nonce, challenge);
      const decoded = jwt.decode(token);
      
      expect(decoded.exp - decoded.iat).toBe(300);
    });

    test('throws without JWT_SECRET', () => {
      delete process.env.JWT_SECRET;
      
      const nonce = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
      const challenge = { difficulty: 18, prefix: 'sealed:' };
      
      expect(() => generateToken(nonce, challenge)).toThrow('JWT_SECRET');
    });
  });

  describe('validateToken', () => {
    test('accepts valid token', () => {
      const nonce = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
      const challenge = { difficulty: 18, prefix: 'sealed:' };
      
      const token = generateToken(nonce, challenge);
      const result = validateToken(token);
      
      expect(result).toBeDefined();
      expect(result.nonce).toBe(nonce);
      expect(result.pow_difficulty).toBe(18);
    });

    test('rejects expired token', () => {
      const payload = {
        jti: 'test-jti',
        iat: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago
        exp: Math.floor(Date.now() / 1000) - 300, // Expired 5 minutes ago
        op: 'create',
        nonce: 'a1b2c3d4e5f67890a1b2c3d4e5f67890',
        pow_difficulty: 18,
        pow_prefix: 'sealed:'
      };
      
      const token = jwt.sign(payload, TEST_SECRET, { algorithm: 'HS256' });
      const result = validateToken(token);
      
      expect(result).toBeNull();
    });

    test('rejects tampered token', () => {
      const nonce = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
      const challenge = { difficulty: 18, prefix: 'sealed:' };
      
      const token = generateToken(nonce, challenge);
      // Tamper with the token
      const tampered = token.slice(0, -10) + 'xxxxxxxxxx';
      
      const result = validateToken(tampered);
      
      expect(result).toBeNull();
    });

    test('rejects token with wrong secret', () => {
      const payload = {
        jti: 'test-jti',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
        op: 'create',
        nonce: 'a1b2c3d4e5f67890a1b2c3d4e5f67890',
        pow_difficulty: 18,
        pow_prefix: 'sealed:'
      };
      
      const token = jwt.sign(payload, 'wrong-secret', { algorithm: 'HS256' });
      const result = validateToken(token);
      
      expect(result).toBeNull();
    });

    test('rejects token missing required claims', () => {
      const payload = {
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
        // Missing jti, nonce, op, pow_difficulty, pow_prefix
      };
      
      const token = jwt.sign(payload, TEST_SECRET, { algorithm: 'HS256' });
      const result = validateToken(token);
      
      expect(result).toBeNull();
    });

    test('throws without JWT_SECRET', () => {
      delete process.env.JWT_SECRET;
      
      expect(() => validateToken('some-token')).toThrow('JWT_SECRET');
    });
  });

  describe('generateNonce', () => {
    test('returns 32 hex chars', () => {
      const nonce = generateNonce();
      
      expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    });

    test('generates unique values', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('generateSecretId', () => {
    test('returns 22 base64url chars', () => {
      const id = generateSecretId();
      
      expect(id.length).toBe(22);
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test('generates unique values', () => {
      const id1 = generateSecretId();
      const id2 = generateSecretId();
      
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateBurnToken', () => {
    test('returns 32 hex chars', () => {
      const token = generateBurnToken();
      
      expect(token).toMatch(/^[0-9a-f]{32}$/);
    });

    test('generates unique values', () => {
      const token1 = generateBurnToken();
      const token2 = generateBurnToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateAccessToken', () => {
    test('returns 32 hex chars', () => {
      const token = generateAccessToken();
      
      expect(token).toMatch(/^[0-9a-f]{32}$/);
    });

    test('generates unique values', () => {
      const token1 = generateAccessToken();
      const token2 = generateAccessToken();
      
      expect(token1).not.toBe(token2);
    });
  });
});
