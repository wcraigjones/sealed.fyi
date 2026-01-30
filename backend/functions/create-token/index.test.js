'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

const { handler, _internal } = require('./index.js');
const {
  generateNonce,
  generateJti,
  createToken,
  TOKEN_TTL_SECONDS,
  NONCE_BYTES,
  DEFAULT_POW_DIFFICULTY,
  POW_PREFIX
} = _internal;

const TEST_JWT_SECRET = 'test-secret-key-for-unit-tests-minimum-32-chars';

describe('Create Token Lambda', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalEnv;
    }
  });

  describe('generateNonce', () => {
    it('should return a hex string of correct length', () => {
      const nonce = generateNonce();
      assert.strictEqual(typeof nonce, 'string');
      assert.strictEqual(nonce.length, NONCE_BYTES * 2); // 32 hex chars
    });

    it('should only contain hex characters', () => {
      const nonce = generateNonce();
      assert.match(nonce, /^[0-9a-f]+$/);
    });

    it('should generate unique nonces', () => {
      const nonces = new Set();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateNonce());
      }
      assert.strictEqual(nonces.size, 100, 'All generated nonces should be unique');
    });
  });

  describe('generateJti', () => {
    it('should return a valid UUID format', () => {
      const jti = generateJti();
      assert.strictEqual(typeof jti, 'string');
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      assert.match(jti, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique JTIs', () => {
      const jtis = new Set();
      for (let i = 0; i < 100; i++) {
        jtis.add(generateJti());
      }
      assert.strictEqual(jtis.size, 100, 'All generated JTIs should be unique');
    });
  });

  describe('createToken', () => {
    it('should create a valid JWT', () => {
      const nonce = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
      const difficulty = 18;
      const prefix = 'sealed:';

      const { token, expiresAt } = createToken(nonce, difficulty, prefix);

      assert.strictEqual(typeof token, 'string');
      assert.strictEqual(typeof expiresAt, 'number');

      // Verify the token can be decoded
      const decoded = jwt.verify(token, TEST_JWT_SECRET);
      assert.ok(decoded);
    });

    it('should include all required claims', () => {
      const nonce = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
      const difficulty = 18;
      const prefix = 'sealed:';

      const { token } = createToken(nonce, difficulty, prefix);
      const decoded = jwt.verify(token, TEST_JWT_SECRET);

      // Check all required claims exist
      assert.ok(decoded.jti, 'jti claim should exist');
      assert.ok(decoded.iat, 'iat claim should exist');
      assert.ok(decoded.exp, 'exp claim should exist');
      assert.strictEqual(decoded.op, 'create', 'op claim should be "create"');
      assert.strictEqual(decoded.nonce, nonce, 'nonce claim should match');
      assert.strictEqual(decoded.pow_difficulty, difficulty, 'pow_difficulty claim should match');
      assert.strictEqual(decoded.pow_prefix, prefix, 'pow_prefix claim should match');
    });

    it('should set correct expiration (5 minutes)', () => {
      const nonce = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
      const now = Math.floor(Date.now() / 1000);

      const { token, expiresAt } = createToken(nonce, 18, 'sealed:');
      const decoded = jwt.verify(token, TEST_JWT_SECRET);

      // Check expiration is approximately 5 minutes from now (allow 2 second tolerance)
      const expectedExpiry = now + TOKEN_TTL_SECONDS;
      assert.ok(Math.abs(decoded.exp - expectedExpiry) <= 2, 'exp should be ~5 minutes from now');
      assert.ok(Math.abs(expiresAt - expectedExpiry) <= 2, 'expiresAt should be ~5 minutes from now');
      assert.strictEqual(decoded.exp, expiresAt, 'exp claim should match expiresAt');
    });

    it('should throw if JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;

      assert.throws(() => {
        createToken('nonce', 18, 'sealed:');
      }, /JWT_SECRET environment variable is not set/);
    });
  });

  describe('handler', () => {
    it('should return 200 status', async () => {
      const response = await handler({});
      assert.strictEqual(response.statusCode, 200);
    });

    it('should return valid JSON body', async () => {
      const response = await handler({});
      const body = JSON.parse(response.body);

      assert.ok(body.token, 'token should exist');
      assert.ok(body.nonce, 'nonce should exist');
      assert.ok(body.powChallenge, 'powChallenge should exist');
      assert.ok(body.expiresAt, 'expiresAt should exist');
    });

    it('should include correct Content-Type header', async () => {
      const response = await handler({});
      assert.strictEqual(response.headers['Content-Type'], 'application/json');
    });

    it('should include no-store Cache-Control header', async () => {
      const response = await handler({});
      assert.strictEqual(response.headers['Cache-Control'], 'no-store');
    });

    it('should return nonce of correct length (32 hex chars)', async () => {
      const response = await handler({});
      const body = JSON.parse(response.body);

      assert.strictEqual(body.nonce.length, 32);
      assert.match(body.nonce, /^[0-9a-f]+$/);
    });

    it('should return valid powChallenge', async () => {
      const response = await handler({});
      const body = JSON.parse(response.body);

      assert.strictEqual(body.powChallenge.difficulty, DEFAULT_POW_DIFFICULTY);
      assert.strictEqual(body.powChallenge.prefix, POW_PREFIX);
    });

    it('should return a valid JWT', async () => {
      const response = await handler({});
      const body = JSON.parse(response.body);

      // Verify token can be decoded and validated
      const decoded = jwt.verify(body.token, TEST_JWT_SECRET);
      assert.ok(decoded);
    });

    it('should have matching nonce in response and JWT', async () => {
      const response = await handler({});
      const body = JSON.parse(response.body);
      const decoded = jwt.verify(body.token, TEST_JWT_SECRET);

      assert.strictEqual(decoded.nonce, body.nonce);
    });

    it('should have matching expiresAt in response and JWT', async () => {
      const response = await handler({});
      const body = JSON.parse(response.body);
      const decoded = jwt.verify(body.token, TEST_JWT_SECRET);

      assert.strictEqual(decoded.exp, body.expiresAt);
    });

    it('should have matching powChallenge in response and JWT', async () => {
      const response = await handler({});
      const body = JSON.parse(response.body);
      const decoded = jwt.verify(body.token, TEST_JWT_SECRET);

      assert.strictEqual(decoded.pow_difficulty, body.powChallenge.difficulty);
      assert.strictEqual(decoded.pow_prefix, body.powChallenge.prefix);
    });

    it('should return token that expires after 5 minutes', async () => {
      const now = Math.floor(Date.now() / 1000);
      const response = await handler({});
      const body = JSON.parse(response.body);

      // Check expiration is approximately 5 minutes from now (allow 2 second tolerance)
      const expectedExpiry = now + TOKEN_TTL_SECONDS;
      assert.ok(Math.abs(body.expiresAt - expectedExpiry) <= 2);
    });

    it('should return 500 if JWT_SECRET is not set', async () => {
      delete process.env.JWT_SECRET;

      const response = await handler({});
      assert.strictEqual(response.statusCode, 500);

      const body = JSON.parse(response.body);
      assert.strictEqual(body.error, 'internal_error');
    });

    it('should generate unique tokens on each call', async () => {
      const response1 = await handler({});
      const response2 = await handler({});

      const body1 = JSON.parse(response1.body);
      const body2 = JSON.parse(response2.body);

      assert.notStrictEqual(body1.token, body2.token);
      assert.notStrictEqual(body1.nonce, body2.nonce);
    });
  });

  describe('response shape matches API contract', () => {
    it('should match the exact response structure from API.md', async () => {
      const response = await handler({});
      const body = JSON.parse(response.body);

      // Verify exact structure
      const keys = Object.keys(body).sort();
      assert.deepStrictEqual(keys, ['expiresAt', 'nonce', 'powChallenge', 'token']);

      const powKeys = Object.keys(body.powChallenge).sort();
      assert.deepStrictEqual(powKeys, ['difficulty', 'prefix']);

      // Verify types
      assert.strictEqual(typeof body.token, 'string');
      assert.strictEqual(typeof body.nonce, 'string');
      assert.strictEqual(typeof body.expiresAt, 'number');
      assert.strictEqual(typeof body.powChallenge.difficulty, 'number');
      assert.strictEqual(typeof body.powChallenge.prefix, 'string');
    });
  });
});
