import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * Token utilities for sealed.fyi authentication.
 * Handles JWT generation/validation and random token generation.
 */

const TOKEN_TTL_SECONDS = 300; // 5 minutes

/**
 * Get JWT secret from environment (evaluated at call time for testability)
 * @returns {string|undefined} JWT secret
 */
function getJwtSecret() {
  return process.env.JWT_SECRET;
}

/**
 * Generate a JWT authorization token
 * @param {string} nonce - 16 bytes hex nonce
 * @param {Object} powChallenge - PoW challenge parameters
 * @param {number} powChallenge.difficulty - Leading zero bits required
 * @param {string} powChallenge.prefix - Prefix for PoW hash input
 * @returns {string} Signed JWT token
 * @throws {Error} If JWT_SECRET is not configured
 */
export function generateToken(nonce, powChallenge) {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not configured');
  }
  
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    jti: crypto.randomUUID(),
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
 * Validate a JWT authorization token
 * @param {string} token - JWT token string
 * @returns {Object|null} Token payload if valid, null otherwise
 */
export function validateToken(token) {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not configured');
  }
  
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    
    // Ensure required claims are present
    if (!payload.jti || !payload.nonce || !payload.op || 
        payload.pow_difficulty === undefined || !payload.pow_prefix) {
      return null;
    }
    
    return payload;
  } catch (error) {
    // Token invalid, expired, or signature mismatch
    return null;
  }
}

/**
 * Generate a random nonce (16 bytes, 32 hex chars)
 * @returns {string} Hex-encoded nonce
 */
export function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate a random secret ID (22 chars base64url)
 * 16 random bytes = 128 bits of entropy
 * @returns {string} Base64url-encoded ID
 */
export function generateSecretId() {
  const bytes = crypto.randomBytes(16);
  // Convert to base64url and take first 22 characters
  return bytes.toString('base64url').slice(0, 22);
}

/**
 * Generate a random burn token (32 hex chars)
 * 16 random bytes = 128 bits of entropy
 * @returns {string} Hex-encoded burn token
 */
export function generateBurnToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate a random access token for idempotency (32 hex chars)
 * 16 random bytes = 128 bits of entropy
 * @returns {string} Hex-encoded access token
 */
export function generateAccessToken() {
  return crypto.randomBytes(16).toString('hex');
}

export default {
  generateToken,
  validateToken,
  generateNonce,
  generateSecretId,
  generateBurnToken,
  generateAccessToken
};
