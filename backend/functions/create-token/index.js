'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Configuration
const TOKEN_TTL_SECONDS = 300; // 5 minutes
const NONCE_BYTES = 16;
const DEFAULT_POW_DIFFICULTY = 18;
const POW_PREFIX = 'sealed:';

/**
 * Generate a cryptographically random nonce
 * @returns {string} 16 bytes as hex (32 chars)
 */
function generateNonce() {
  return crypto.randomBytes(NONCE_BYTES).toString('hex');
}

/**
 * Generate a UUID v4 for the JWT jti claim
 * @returns {string} UUID v4 string
 */
function generateJti() {
  return crypto.randomUUID();
}

/**
 * Create a JWT token with the required claims
 * @param {string} nonce - The nonce to include in the token
 * @param {number} difficulty - PoW difficulty level
 * @param {string} prefix - PoW prefix string
 * @returns {{ token: string, expiresAt: number }}
 */
function createToken(nonce, difficulty, prefix) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + TOKEN_TTL_SECONDS;

  const payload = {
    jti: generateJti(),
    iat: now,
    exp: expiresAt,
    op: 'create',
    nonce: nonce,
    pow_difficulty: difficulty,
    pow_prefix: prefix
  };

  const token = jwt.sign(payload, secret, { algorithm: 'HS256' });

  return { token, expiresAt };
}

/**
 * Lambda handler for POST /token
 * Issues short-lived authorization tokens for secret creation
 */
exports.handler = async (event) => {
  try {
    // Generate random nonce
    const nonce = generateNonce();
    
    // PoW challenge parameters (static difficulty for now, can be adaptive later)
    const powChallenge = {
      difficulty: DEFAULT_POW_DIFFICULTY,
      prefix: POW_PREFIX
    };

    // Create JWT token
    const { token, expiresAt } = createToken(
      nonce,
      powChallenge.difficulty,
      powChallenge.prefix
    );

    // Build response
    const response = {
      token,
      nonce,
      powChallenge,
      expiresAt
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error('Error creating token:', error.message);

    // Return generic error to avoid leaking internal details
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({ error: 'internal_error' })
    };
  }
};

// Export internal functions for testing
exports._internal = {
  generateNonce,
  generateJti,
  createToken,
  TOKEN_TTL_SECONDS,
  NONCE_BYTES,
  DEFAULT_POW_DIFFICULTY,
  POW_PREFIX
};
