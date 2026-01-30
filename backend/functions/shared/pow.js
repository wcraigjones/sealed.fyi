'use strict';

const crypto = require('crypto');

// Default configuration
const DEFAULT_DIFFICULTY = 18;
const DEFAULT_PREFIX = 'sealed:';

/**
 * @typedef {object} Challenge
 * @property {number} difficulty - Number of leading zero bits required
 * @property {string} prefix - Prefix for the hash input
 */

/**
 * Generate a PoW challenge
 * @param {number} [difficulty=18] - Number of leading zero bits required
 * @param {string} [prefix='sealed:'] - Prefix for the hash input
 * @returns {Challenge}
 */
function generateChallenge(difficulty = DEFAULT_DIFFICULTY, prefix = DEFAULT_PREFIX) {
  return {
    difficulty: difficulty,
    prefix: prefix
  };
}

/**
 * Compute SHA-256 hash of a string
 * @param {string} input - String to hash
 * @returns {Buffer} Hash as buffer
 */
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest();
}

/**
 * Count leading zero bits in a buffer
 * @param {Buffer} buffer - Buffer to check
 * @returns {number} Number of leading zero bits
 */
function countLeadingZeroBits(buffer) {
  let zeroBits = 0;

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    
    if (byte === 0) {
      // Full byte of zeros
      zeroBits += 8;
    } else {
      // Count leading zeros in this byte using Math.clz32
      // clz32 counts for 32-bit, so we adjust for 8-bit
      zeroBits += Math.clz32(byte) - 24;
      break;
    }
  }

  return zeroBits;
}

/**
 * Verify a proof-of-work solution
 * @param {string} nonce - The nonce from the token
 * @param {string} solution - The solution provided by the client
 * @param {Challenge} challenge - The PoW challenge parameters
 * @returns {boolean} True if the solution is valid
 */
function verifyPow(nonce, solution, challenge) {
  // Validate inputs
  if (!nonce || typeof nonce !== 'string') {
    return false;
  }
  if (!solution || typeof solution !== 'string') {
    return false;
  }
  if (!challenge || typeof challenge.difficulty !== 'number' || !challenge.prefix) {
    return false;
  }

  // Construct the input: prefix + nonce + solution
  const input = challenge.prefix + nonce + solution;
  
  // Compute hash
  const hash = sha256(input);
  
  // Check leading zero bits
  const leadingZeros = countLeadingZeroBits(hash);
  
  return leadingZeros >= challenge.difficulty;
}

/**
 * Solve a proof-of-work challenge (for testing purposes)
 * Note: In production, this is done client-side in the browser
 * @param {string} nonce - The nonce from the token
 * @param {Challenge} challenge - The PoW challenge parameters
 * @param {number} [maxAttempts=10000000] - Maximum number of attempts
 * @returns {string|null} Solution string or null if not found within attempts
 */
function solvePow(nonce, challenge, maxAttempts = 10000000) {
  for (let i = 0; i < maxAttempts; i++) {
    const solution = i.toString();
    if (verifyPow(nonce, solution, challenge)) {
      return solution;
    }
  }
  return null;
}

module.exports = {
  generateChallenge,
  verifyPow,
  // For testing
  _internal: {
    sha256,
    countLeadingZeroBits,
    solvePow,
    DEFAULT_DIFFICULTY,
    DEFAULT_PREFIX
  }
};
