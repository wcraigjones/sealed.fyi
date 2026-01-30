'use strict';

// Validation constants
const TTL_MIN = 900;         // 15 minutes
const TTL_MAX = 7776000;     // 90 days
const MAX_VIEWS_MIN = 1;
const MAX_VIEWS_MAX = 5;
const MAX_CIPHERTEXT_BYTES = 68 * 1024;  // 68 KB
const IV_BYTES = 12;
const SALT_BYTES = 16;
const NONCE_BYTES = 16;

/**
 * Check if a string is valid base64
 * @param {string} str - String to check
 * @returns {boolean} True if valid base64
 */
function isValidBase64(str) {
  if (!str || typeof str !== 'string') {
    return false;
  }
  
  // Base64 pattern: alphanumeric, +, /, and = for padding
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  
  // Length must be a multiple of 4 (with padding)
  if (!base64Regex.test(str)) {
    return false;
  }
  
  try {
    // Try to decode and ensure it's reversible
    const decoded = Buffer.from(str, 'base64');
    return decoded.toString('base64') === str;
  } catch {
    return false;
  }
}

/**
 * Get the byte length of a base64 string when decoded
 * @param {string} base64Str - Base64 encoded string
 * @returns {number} Byte length of decoded data
 */
function getBase64ByteLength(base64Str) {
  if (!base64Str || typeof base64Str !== 'string') {
    return 0;
  }
  
  // Remove padding characters for calculation
  const padding = (base64Str.match(/=/g) || []).length;
  return Math.floor((base64Str.length * 3) / 4) - padding;
}

/**
 * Check if a string is valid hexadecimal
 * @param {string} str - String to check
 * @returns {boolean} True if valid hex
 */
function isValidHex(str) {
  if (!str || typeof str !== 'string') {
    return false;
  }
  return /^[a-fA-F0-9]+$/.test(str);
}

/**
 * Validate TTL (time-to-live) value
 * @param {*} ttl - TTL value to validate
 * @returns {boolean} True if valid (900 to 7776000 seconds)
 */
function validateTTL(ttl) {
  if (typeof ttl !== 'number' || !Number.isInteger(ttl)) {
    return false;
  }
  return ttl >= TTL_MIN && ttl <= TTL_MAX;
}

/**
 * Validate maxViews value
 * @param {*} maxViews - Max views value to validate
 * @returns {boolean} True if valid (1 to 5)
 */
function validateMaxViews(maxViews) {
  if (typeof maxViews !== 'number' || !Number.isInteger(maxViews)) {
    return false;
  }
  return maxViews >= MAX_VIEWS_MIN && maxViews <= MAX_VIEWS_MAX;
}

/**
 * Validate ciphertext
 * @param {*} ciphertext - Ciphertext to validate
 * @returns {boolean} True if valid base64 and within size limit (max 68KB)
 */
function validateCiphertext(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') {
    return false;
  }
  
  if (!isValidBase64(ciphertext)) {
    return false;
  }
  
  const byteLength = getBase64ByteLength(ciphertext);
  return byteLength > 0 && byteLength <= MAX_CIPHERTEXT_BYTES;
}

/**
 * Validate IV (initialization vector)
 * @param {*} iv - IV to validate
 * @returns {boolean} True if valid base64 and exactly 12 bytes
 */
function validateIV(iv) {
  if (!iv || typeof iv !== 'string') {
    return false;
  }
  
  if (!isValidBase64(iv)) {
    return false;
  }
  
  return getBase64ByteLength(iv) === IV_BYTES;
}

/**
 * Validate salt
 * @param {*} salt - Salt to validate (can be null for non-passphrase-protected secrets)
 * @returns {boolean} True if valid (16 bytes base64 or null)
 */
function validateSalt(salt) {
  // Null is valid (for non-passphrase-protected secrets)
  if (salt === null) {
    return true;
  }
  
  if (typeof salt !== 'string') {
    return false;
  }
  
  if (!isValidBase64(salt)) {
    return false;
  }
  
  return getBase64ByteLength(salt) === SALT_BYTES;
}

/**
 * Validate nonce
 * @param {*} nonce - Nonce to validate
 * @returns {boolean} True if valid hex and exactly 16 bytes (32 chars)
 */
function validateNonce(nonce) {
  if (!nonce || typeof nonce !== 'string') {
    return false;
  }
  
  if (!isValidHex(nonce)) {
    return false;
  }
  
  // 16 bytes = 32 hex characters
  return nonce.length === NONCE_BYTES * 2;
}

/**
 * Validate secret ID format
 * @param {*} id - Secret ID to validate
 * @returns {boolean} True if valid (22 char base64url)
 */
function validateSecretId(id) {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  // base64url: alphanumeric, -, _
  // Length must be exactly 22 characters
  if (id.length !== 22) {
    return false;
  }
  
  return /^[A-Za-z0-9_-]+$/.test(id);
}

/**
 * Validate burn token format
 * @param {*} burnToken - Burn token to validate
 * @returns {boolean} True if valid (32 char hex)
 */
function validateBurnToken(burnToken) {
  if (!burnToken || typeof burnToken !== 'string') {
    return false;
  }
  
  if (!isValidHex(burnToken)) {
    return false;
  }
  
  // 16 bytes = 32 hex characters
  return burnToken.length === 32;
}

/**
 * Validate access token format
 * @param {*} accessToken - Access token to validate
 * @returns {boolean} True if valid (32 char hex)
 */
function validateAccessToken(accessToken) {
  // Access token is optional
  if (accessToken === undefined || accessToken === null || accessToken === '') {
    return true;
  }
  
  if (typeof accessToken !== 'string') {
    return false;
  }
  
  if (!isValidHex(accessToken)) {
    return false;
  }
  
  return accessToken.length === 32;
}

/**
 * Validate the complete create secret request body
 * @param {object} body - Request body to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateCreateSecretRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  if (!validateCiphertext(body.ciphertext)) {
    return { valid: false, error: 'Invalid or missing ciphertext' };
  }

  if (!validateIV(body.iv)) {
    return { valid: false, error: 'Invalid or missing iv (must be 12 bytes base64)' };
  }

  if (!validateSalt(body.salt)) {
    return { valid: false, error: 'Invalid salt (must be 16 bytes base64 or null)' };
  }

  if (!validateNonce(body.nonce)) {
    return { valid: false, error: 'Invalid or missing nonce (must be 32 char hex)' };
  }

  if (body.pow === undefined || body.pow === null || body.pow === '') {
    return { valid: false, error: 'Missing pow solution' };
  }

  if (!validateTTL(body.ttl)) {
    return { valid: false, error: `Invalid ttl (must be ${TTL_MIN} to ${TTL_MAX} seconds)` };
  }

  if (!validateMaxViews(body.maxViews)) {
    return { valid: false, error: `Invalid maxViews (must be ${MAX_VIEWS_MIN} to ${MAX_VIEWS_MAX})` };
  }

  if (typeof body.passphraseProtected !== 'boolean') {
    return { valid: false, error: 'passphraseProtected must be a boolean' };
  }

  // Consistency check: if passphrase protected, salt must be present
  if (body.passphraseProtected && body.salt === null) {
    return { valid: false, error: 'salt is required when passphraseProtected is true' };
  }

  return { valid: true };
}

module.exports = {
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
  // Constants
  TTL_MIN,
  TTL_MAX,
  MAX_VIEWS_MIN,
  MAX_VIEWS_MAX,
  MAX_CIPHERTEXT_BYTES,
  IV_BYTES,
  SALT_BYTES,
  NONCE_BYTES,
  // For testing
  _internal: {
    isValidBase64,
    getBase64ByteLength,
    isValidHex
  }
};
