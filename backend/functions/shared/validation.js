/**
 * Input validation helpers for sealed.fyi Lambda functions.
 * All validators return boolean indicating validity.
 */

// TTL bounds in seconds
const MIN_TTL = 900;        // 15 minutes
const MAX_TTL = 7776000;    // 90 days

// Max views bounds
const MIN_MAX_VIEWS = 1;
const MAX_MAX_VIEWS = 5;

// Max ciphertext size in bytes (after base64 decoding)
// 50KB plaintext + encryption overhead (~68KB base64)
const MAX_CIPHERTEXT_SIZE = 68 * 1024;

// IV must be exactly 12 bytes (96 bits for AES-GCM)
const IV_BYTES = 12;

// Salt must be exactly 16 bytes (128 bits for PBKDF2)
const SALT_BYTES = 16;

// Nonce must be exactly 16 bytes (32 hex chars)
const NONCE_BYTES = 16;

/**
 * Check if a string is valid base64
 * @param {string} str - String to validate
 * @returns {boolean} True if valid base64
 */
function isValidBase64(str) {
  if (typeof str !== 'string' || str.length === 0) {
    return false;
  }
  
  // Standard base64 pattern (allows padding)
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  
  // Check format
  if (!base64Regex.test(str)) {
    return false;
  }
  
  // Validate length is divisible by 4 (accounting for padding)
  if (str.length % 4 !== 0) {
    return false;
  }
  
  try {
    // Try to decode to verify it's valid
    Buffer.from(str, 'base64');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the byte length of a base64 string when decoded
 * @param {string} base64Str - Base64 string
 * @returns {number} Decoded byte length
 */
function getBase64DecodedLength(base64Str) {
  if (typeof base64Str !== 'string') {
    return 0;
  }
  
  // Remove padding for calculation
  let len = base64Str.length;
  let padding = 0;
  
  if (base64Str.endsWith('==')) {
    padding = 2;
  } else if (base64Str.endsWith('=')) {
    padding = 1;
  }
  
  return Math.floor((len * 3) / 4) - padding;
}

/**
 * Check if a string is valid hex
 * @param {string} str - String to validate
 * @returns {boolean} True if valid hex
 */
function isValidHex(str) {
  if (typeof str !== 'string' || str.length === 0) {
    return false;
  }
  
  return /^[0-9a-fA-F]+$/.test(str);
}

/**
 * Validate TTL (time-to-live in seconds)
 * @param {number} ttl - TTL value to validate
 * @returns {boolean} True if TTL is in valid range (900 to 7776000)
 */
export function validateTTL(ttl) {
  if (typeof ttl !== 'number' || !Number.isInteger(ttl)) {
    return false;
  }
  
  return ttl >= MIN_TTL && ttl <= MAX_TTL;
}

/**
 * Validate maxViews
 * @param {number} maxViews - Max views value to validate
 * @returns {boolean} True if maxViews is in valid range (1 to 5)
 */
export function validateMaxViews(maxViews) {
  if (typeof maxViews !== 'number' || !Number.isInteger(maxViews)) {
    return false;
  }
  
  return maxViews >= MIN_MAX_VIEWS && maxViews <= MAX_MAX_VIEWS;
}

/**
 * Validate ciphertext
 * @param {string} ciphertext - Base64-encoded ciphertext to validate
 * @returns {boolean} True if ciphertext is valid base64 and under size limit
 */
export function validateCiphertext(ciphertext) {
  if (!isValidBase64(ciphertext)) {
    return false;
  }
  
  const decodedLength = getBase64DecodedLength(ciphertext);
  return decodedLength > 0 && decodedLength <= MAX_CIPHERTEXT_SIZE;
}

/**
 * Validate initialization vector (IV)
 * @param {string} iv - Base64-encoded IV to validate
 * @returns {boolean} True if IV is valid base64 and exactly 12 bytes
 */
export function validateIV(iv) {
  if (!isValidBase64(iv)) {
    return false;
  }
  
  const decodedLength = getBase64DecodedLength(iv);
  return decodedLength === IV_BYTES;
}

/**
 * Validate salt
 * @param {string|null} salt - Base64-encoded salt to validate, or null
 * @returns {boolean} True if salt is null or valid base64 with exactly 16 bytes
 */
export function validateSalt(salt) {
  // null is valid (no passphrase protection)
  if (salt === null) {
    return true;
  }
  
  if (!isValidBase64(salt)) {
    return false;
  }
  
  const decodedLength = getBase64DecodedLength(salt);
  return decodedLength === SALT_BYTES;
}

/**
 * Validate nonce
 * @param {string} nonce - Hex-encoded nonce to validate
 * @returns {boolean} True if nonce is valid hex and exactly 16 bytes (32 chars)
 */
export function validateNonce(nonce) {
  if (!isValidHex(nonce)) {
    return false;
  }
  
  // 16 bytes = 32 hex characters
  return nonce.length === NONCE_BYTES * 2;
}

/**
 * Validate secret ID format
 * @param {string} id - Secret ID to validate
 * @returns {boolean} True if ID is 22 chars and base64url safe
 */
export function validateSecretId(id) {
  if (typeof id !== 'string') {
    return false;
  }
  
  // Must be exactly 22 characters
  if (id.length !== 22) {
    return false;
  }
  
  // Base64url alphabet: A-Z, a-z, 0-9, -, _
  return /^[A-Za-z0-9_-]+$/.test(id);
}

/**
 * Validate burn token format
 * @param {string} token - Burn token to validate
 * @returns {boolean} True if token is 32 hex characters
 */
export function validateBurnToken(token) {
  if (!isValidHex(token)) {
    return false;
  }
  
  // 16 bytes = 32 hex characters
  return token.length === 32;
}

export default {
  validateTTL,
  validateMaxViews,
  validateCiphertext,
  validateIV,
  validateSalt,
  validateNonce,
  validateSecretId,
  validateBurnToken
};
