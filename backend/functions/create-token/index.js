'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Configuration constants
const TOKEN_TTL_SECONDS = 300; // 5 minutes
const NONCE_BYTES = 16;
const POW_DIFFICULTY = 18;
const POW_PREFIX = 'sealed:';

/**
 * Generate a cryptographically random nonce (16 bytes as hex)
 * @returns {string} 32-character hex string
 */
function generateNonce() {
  return crypto.randomBytes(NONCE_BYTES).toString('hex');
}

/**
 * Generate a UUID v4 for the JWT jti claim
 * @returns {string} UUID string
 */
function generateJti() {
  return crypto.randomUUID();
}

/**
 * Create JWT token with required claims
 * @param {string} nonce - The nonce to include in the token
 * @param {string} secret - JWT signing secret
 * @returns {{token: string, expiresAt: number}}
 */
function createToken(nonce, secret) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + TOKEN_TTL_SECONDS;

  const payload = {
    jti: generateJti(),
    iat: now,
    exp: expiresAt,
    op: 'create',
    nonce: nonce,
    pow_difficulty: POW_DIFFICULTY,
    pow_prefix: POW_PREFIX
  };

  const token = jwt.sign(payload, secret, { algorithm: 'HS256' });

  return { token, expiresAt };
}

/**
 * Build success response with CORS headers
 * @param {number} statusCode - HTTP status code
 * @param {object} body - Response body
 * @returns {object} API Gateway response
 */
function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Burn-Token',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

/**
 * Lambda handler for POST /token
 * @param {object} event - API Gateway event
 * @returns {object} API Gateway response
 */
exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return buildResponse(204, null);
  }

  try {
    // Get JWT secret from environment
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable not set');
      return buildResponse(500, { error: 'server_error', message: 'Server configuration error' });
    }

    // Generate random nonce
    const nonce = generateNonce();

    // Create JWT token
    const { token, expiresAt } = createToken(nonce, jwtSecret);

    // Build response matching API contract
    const response = {
      token,
      nonce,
      powChallenge: {
        difficulty: POW_DIFFICULTY,
        prefix: POW_PREFIX
      },
      expiresAt
    };

    return buildResponse(200, response);
  } catch (error) {
    console.error('Error creating token:', error);
    return buildResponse(500, { error: 'server_error', message: 'Failed to create token' });
  }
};

// Export internals for testing
exports._internals = {
  generateNonce,
  generateJti,
  createToken,
  buildResponse,
  TOKEN_TTL_SECONDS,
  NONCE_BYTES,
  POW_DIFFICULTY,
  POW_PREFIX
};
