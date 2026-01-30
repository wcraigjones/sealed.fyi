'use strict';

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

const { handler, _internals } = require('./index.js');
const {
  generateNonce,
  generateJti,
  createToken,
  buildResponse,
  TOKEN_TTL_SECONDS,
  NONCE_BYTES,
  POW_DIFFICULTY,
  POW_PREFIX
} = _internals;

const TEST_JWT_SECRET = 'test-secret-key-for-unit-tests-only';

describe('create-token Lambda', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.JWT_SECRET = originalEnv;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  describe('generateNonce', () => {
    it('should generate a 32-character hex string', () => {
      const nonce = generateNonce();
      assert.strictEqual(nonce.length, 32);
      assert.match(nonce, /^[0-9a-f]{32}$/);
    });

    it('should generate unique nonces on each call', () => {
      const nonces = new Set();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateNonce());
      }
      assert.strictEqual(nonces.size, 100, 'All generated nonces should be unique');
    });
  });

  describe('generateJti', () => {
    it('should generate a valid UUID format', () => {
      const jti = generateJti();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert.match(jti, uuidRegex, 'JTI should be a valid UUID v4');
    });

    it('should generate unique JTIs on each call', () => {
      const jtis = new Set();
      for (let i = 0; i < 100; i++) {
        jtis.add(generateJti());
      }
      assert.strictEqual(jtis.size, 100, 'All generated JTIs should be unique');
    });
  });

  describe('createToken', () => {
    it('should create a valid JWT', () => {
      const nonce = 'test-nonce-12345678901234567890';
      const { token, expiresAt } = createToken(nonce, TEST_JWT_SECRET);

      assert.ok(token, 'Token should be truthy');
      assert.ok(token.split('.').length === 3, 'Token should have 3 parts (JWT format)');

      // Verify the token can be decoded
      const decoded = jwt.verify(token, TEST_JWT_SECRET);
      assert.ok(decoded, 'Token should be verifiable');
    });

    it('should include all required JWT claims', () => {
      const nonce = 'test-nonce-12345678901234567890';
      const { token } = createToken(nonce, TEST_JWT_SECRET);

      const decoded = jwt.verify(token, TEST_JWT_SECRET);

      // Verify required claims
      assert.ok(decoded.jti, 'JWT should include jti claim');
      assert.ok(decoded.iat, 'JWT should include iat claim');
      assert.ok(decoded.exp, 'JWT should include exp claim');
      assert.strictEqual(decoded.op, 'create', 'JWT should include op claim with value "create"');
      assert.strictEqual(decoded.nonce, nonce, 'JWT should include nonce claim');
      assert.strictEqual(decoded.pow_difficulty, POW_DIFFICULTY, 'JWT should include pow_difficulty claim');
      assert.strictEqual(decoded.pow_prefix, POW_PREFIX, 'JWT should include pow_prefix claim');
    });

    it('should set token expiration to 5 minutes from now', () => {
      const nonce = 'test-nonce-12345678901234567890';
      const beforeTime = Math.floor(Date.now() / 1000);
      const { token, expiresAt } = createToken(nonce, TEST_JWT_SECRET);
      const afterTime = Math.floor(Date.now() / 1000);

      const decoded = jwt.verify(token, TEST_JWT_SECRET);

      // Token should expire approximately 5 minutes (300 seconds) after issue
      assert.ok(
        decoded.exp >= beforeTime + TOKEN_TTL_SECONDS && decoded.exp <= afterTime + TOKEN_TTL_SECONDS,
        'Token expiration should be 5 minutes from issue time'
      );

      // expiresAt should match exp claim
      assert.strictEqual(expiresAt, decoded.exp, 'expiresAt should match exp claim');
    });
  });

  describe('buildResponse', () => {
    it('should build a response with correct structure', () => {
      const body = { test: 'data' };
      const response = buildResponse(200, body);

      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.headers['Content-Type'], 'application/json');
      assert.strictEqual(response.headers['Cache-Control'], 'no-store');
      assert.strictEqual(response.body, JSON.stringify(body));
    });

    it('should include CORS headers', () => {
      const response = buildResponse(200, {});

      assert.ok(response.headers['Access-Control-Allow-Origin'], 'Should include CORS origin header');
      assert.ok(response.headers['Access-Control-Allow-Headers'], 'Should include CORS headers header');
      assert.ok(response.headers['Access-Control-Allow-Methods'], 'Should include CORS methods header');
    });
  });

  describe('handler', () => {
    it('should return valid response matching API contract', async () => {
      const event = { httpMethod: 'POST' };
      const response = await handler(event);

      assert.strictEqual(response.statusCode, 200);

      const body = JSON.parse(response.body);
      assert.ok(body.token, 'Response should include token');
      assert.ok(body.nonce, 'Response should include nonce');
      assert.ok(body.powChallenge, 'Response should include powChallenge');
      assert.ok(body.expiresAt, 'Response should include expiresAt');
    });

    it('should include valid JWT in response', async () => {
      const event = { httpMethod: 'POST' };
      const response = await handler(event);
      const body = JSON.parse(response.body);

      // Verify JWT is valid
      const decoded = jwt.verify(body.token, TEST_JWT_SECRET);
      assert.ok(decoded, 'Token should be verifiable');
    });

    it('should return nonce that matches JWT nonce claim', async () => {
      const event = { httpMethod: 'POST' };
      const response = await handler(event);
      const body = JSON.parse(response.body);

      const decoded = jwt.verify(body.token, TEST_JWT_SECRET);
      assert.strictEqual(body.nonce, decoded.nonce, 'Response nonce should match JWT nonce claim');
    });

    it('should return nonce with correct length (32 chars hex)', async () => {
      const event = { httpMethod: 'POST' };
      const response = await handler(event);
      const body = JSON.parse(response.body);

      assert.strictEqual(body.nonce.length, 32, 'Nonce should be 32 characters');
      assert.match(body.nonce, /^[0-9a-f]{32}$/, 'Nonce should be hex');
    });

    it('should return powChallenge with correct structure', async () => {
      const event = { httpMethod: 'POST' };
      const response = await handler(event);
      const body = JSON.parse(response.body);

      assert.strictEqual(body.powChallenge.difficulty, POW_DIFFICULTY);
      assert.strictEqual(body.powChallenge.prefix, POW_PREFIX);
    });

    it('should return unique nonces on each call', async () => {
      const nonces = new Set();
      for (let i = 0; i < 10; i++) {
        const event = { httpMethod: 'POST' };
        const response = await handler(event);
        const body = JSON.parse(response.body);
        nonces.add(body.nonce);
      }
      assert.strictEqual(nonces.size, 10, 'Each call should return a unique nonce');
    });

    it('should handle CORS preflight OPTIONS request', async () => {
      const event = { httpMethod: 'OPTIONS' };
      const response = await handler(event);

      assert.strictEqual(response.statusCode, 204);
      assert.ok(response.headers['Access-Control-Allow-Origin']);
      assert.ok(response.headers['Access-Control-Allow-Methods']);
    });

    it('should handle HTTP API Gateway v2 format', async () => {
      const event = {
        requestContext: {
          http: { method: 'POST' }
        }
      };
      const response = await handler(event);

      assert.strictEqual(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.ok(body.token);
    });

    it('should return 500 when JWT_SECRET is not set', async () => {
      delete process.env.JWT_SECRET;

      const event = { httpMethod: 'POST' };
      const response = await handler(event);

      assert.strictEqual(response.statusCode, 500);
      const body = JSON.parse(response.body);
      assert.strictEqual(body.error, 'server_error');
    });

    it('should set Cache-Control to no-store', async () => {
      const event = { httpMethod: 'POST' };
      const response = await handler(event);

      assert.strictEqual(response.headers['Cache-Control'], 'no-store');
    });

    it('should return expiresAt matching JWT exp claim', async () => {
      const event = { httpMethod: 'POST' };
      const response = await handler(event);
      const body = JSON.parse(response.body);

      const decoded = jwt.verify(body.token, TEST_JWT_SECRET);
      assert.strictEqual(body.expiresAt, decoded.exp);
    });
  });

  describe('constants', () => {
    it('should have TOKEN_TTL_SECONDS set to 300 (5 minutes)', () => {
      assert.strictEqual(TOKEN_TTL_SECONDS, 300);
    });

    it('should have NONCE_BYTES set to 16', () => {
      assert.strictEqual(NONCE_BYTES, 16);
    });

    it('should have POW_DIFFICULTY set to 18', () => {
      assert.strictEqual(POW_DIFFICULTY, 18);
    });

    it('should have POW_PREFIX set to "sealed:"', () => {
      assert.strictEqual(POW_PREFIX, 'sealed:');
    });
  });
});
