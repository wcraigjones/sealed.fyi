'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Configuration
const TOKEN_TTL_SECONDS = 300; // 5 minutes
const NONCE_BYTES = 16;
const SECRET_ID_BYTES = 16;
const BURN_TOKEN_BYTES = 16;
const ACCESS_TOKEN_BYTES = 16;
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
 * Generate a cryptographically random secret ID
 * @returns {string} 22 chars base64url (128 bits of entropy)
 */
function generateSecretId() {
  return crypto.randomBytes(SECRET_ID_BYTES).toString('base64url').slice(0, 22);
}

/**
 * Generate a cryptographically random burn token
 * @returns {string} 32 chars hex (128 bits of entropy)
 */
function generateBurnToken() {
  return crypto.randomBytes(BURN_TOKEN_BYTES).toString('hex');
}

/**
 * Generate a cryptographically random access token for idempotency
 * @returns {string} 32 chars hex (128 bits of entropy)
 */
function generateAccessToken() {
  return crypto.randomBytes(ACCESS_TOKEN_BYTES).toString('hex');
}

/**
 * Generate a UUID v4 for the JWT jti claim
 * @returns {string} UUID v4 string
 */
function generateJti() {
  return crypto.randomUUID();
}

/**
 * Get JWT secret from environment
 * @returns {string}
 * @throws {Error} If JWT_SECRET is not set
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Generate a PoW challenge
 * @returns {{ difficulty: number, prefix: string }}
 */
function generateChallenge() {
  return {
    difficulty: DEFAULT_POW_DIFFICULTY,
    prefix: POW_PREFIX
  };
}

/**
 * Generate a JWT token for secret creation
 * @param {string} nonce - The nonce to include in the token
 * @param {{ difficulty: number, prefix: string }} powChallenge - PoW challenge parameters
 * @returns {string} JWT token string
 */
function generateToken(nonce, powChallenge) {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    jti: generateJti(),
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    op: 'create',
    nonce: nonce,
    pow_difficulty: powChallenge.difficulty,
    pow_prefix: powChallenge.prefix
  };

  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

/**
 * @typedef {object} TokenPayload
 * @property {string} jti - Unique token ID
 * @property {number} iat - Issued at timestamp
 * @property {number} exp - Expiration timestamp
 * @property {string} op - Operation type ('create')
 * @property {string} nonce - Nonce bound to this token
 * @property {number} pow_difficulty - PoW difficulty level
 * @property {string} pow_prefix - PoW prefix string
 */

/**
 * Validate and decode a JWT token
 * @param {string} token - JWT token string
 * @returns {TokenPayload|null} Decoded payload or null if invalid
 */
function validateToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const secret = getJwtSecret();
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256']
    });

    // Verify required claims exist
    if (
      !payload.jti ||
      !payload.nonce ||
      !payload.op ||
      typeof payload.pow_difficulty !== 'number' ||
      !payload.pow_prefix
    ) {
      return null;
    }

    // Verify operation type
    if (payload.op !== 'create') {
      return null;
    }

    return payload;
  } catch (error) {
    // Token is invalid, expired, or tampered with
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token string or null if invalid format
 */
function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  // Ensure token is not empty
  const token = parts[1];
  if (!token) {
    return null;
  }

  return token;
}

module.exports = {
  generateToken,
  validateToken,
  generateNonce,
  generateSecretId,
  generateBurnToken,
  generateAccessToken,
  generateChallenge,
  extractBearerToken,
  // Constants for reference
  TOKEN_TTL_SECONDS,
  DEFAULT_POW_DIFFICULTY,
  POW_PREFIX,
  // For testing
  _internal: {
    generateJti,
    getJwtSecret,
    NONCE_BYTES,
    SECRET_ID_BYTES,
    BURN_TOKEN_BYTES,
    ACCESS_TOKEN_BYTES
  }
};
