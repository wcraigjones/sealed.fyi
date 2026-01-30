import crypto from 'crypto';

/**
 * Server-side Proof-of-Work verification for sealed.fyi.
 * Uses SHA-256 hashcash-style PoW with configurable difficulty.
 */

const DEFAULT_DIFFICULTY = 18;
const DEFAULT_PREFIX = 'sealed:';

/**
 * @typedef {Object} Challenge
 * @property {number} difficulty - Number of leading zero bits required
 * @property {string} prefix - Prefix string for hash input
 */

/**
 * Generate a new PoW challenge
 * @param {number} [difficulty] - Optional custom difficulty (default: 18)
 * @returns {Challenge} Challenge parameters
 */
export function generateChallenge(difficulty = DEFAULT_DIFFICULTY) {
  return {
    difficulty: difficulty,
    prefix: DEFAULT_PREFIX
  };
}

/**
 * Count leading zero bits in a buffer
 * @param {Buffer} hash - Hash buffer to check
 * @returns {number} Number of leading zero bits
 */
function countLeadingZeroBits(hash) {
  let zeroBits = 0;
  
  for (let i = 0; i < hash.length; i++) {
    const byte = hash[i];
    
    if (byte === 0) {
      zeroBits += 8;
    } else {
      // Count leading zeros in this byte
      for (let bit = 7; bit >= 0; bit--) {
        if ((byte & (1 << bit)) === 0) {
          zeroBits++;
        } else {
          return zeroBits;
        }
      }
    }
  }
  
  return zeroBits;
}

/**
 * Verify a PoW solution
 * @param {string} nonce - Server-provided nonce
 * @param {string} solution - Client-provided solution (counter value)
 * @param {Challenge} challenge - Challenge parameters
 * @returns {boolean} True if solution is valid
 */
export function verifyPow(nonce, solution, challenge) {
  if (!nonce || solution === undefined || solution === null || !challenge) {
    return false;
  }
  
  if (typeof challenge.difficulty !== 'number' || challenge.difficulty < 0) {
    return false;
  }
  
  if (!challenge.prefix) {
    return false;
  }
  
  // Build the hash input: prefix + nonce + solution
  const input = `${challenge.prefix}${nonce}${solution}`;
  
  // Compute SHA-256 hash
  const hash = crypto.createHash('sha256').update(input).digest();
  
  // Check if hash has required leading zero bits
  const leadingZeros = countLeadingZeroBits(hash);
  
  return leadingZeros >= challenge.difficulty;
}

export default {
  generateChallenge,
  verifyPow
};
