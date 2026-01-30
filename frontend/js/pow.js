/**
 * sealed.fyi - Proof-of-Work Module
 * 
 * Implements SHA-256 hashcash-style proof-of-work for anti-abuse.
 * The challenge is to find a solution where:
 *   SHA256(prefix + nonce + solution) has `difficulty` leading zero bits.
 * 
 * All cryptographic operations use the Web Crypto API exclusively.
 */

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_PREFIX = 'sealed:';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert a Uint8Array to hex string.
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encode a UTF-8 string to Uint8Array.
 * @param {string} str 
 * @returns {Uint8Array}
 */
function stringToBytes(str) {
  return new TextEncoder().encode(str);
}

/**
 * Check if a hash has the required number of leading zero bits.
 * @param {Uint8Array} hash - The hash bytes
 * @param {number} difficulty - Number of leading zero bits required
 * @returns {boolean}
 */
function hasLeadingZeroBits(hash, difficulty) {
  if (difficulty <= 0) {
    return true;
  }
  
  // Calculate how many full bytes of zeros we need
  const fullBytes = Math.floor(difficulty / 8);
  const remainingBits = difficulty % 8;
  
  // Check full bytes first (must all be 0x00)
  for (let i = 0; i < fullBytes; i++) {
    if (hash[i] !== 0) {
      return false;
    }
  }
  
  // Check remaining bits in the next byte if needed
  if (remainingBits > 0 && fullBytes < hash.length) {
    // The next byte must have `remainingBits` leading zeros
    // For example, if remainingBits = 3, the byte must be <= 0x1F (00011111)
    const mask = 0xFF >> remainingBits;  // Bits that can be non-zero
    const requiredZeroMask = ~mask & 0xFF;  // Bits that must be zero
    if ((hash[fullBytes] & requiredZeroMask) !== 0) {
      return false;
    }
  }
  
  return true;
}

/**
 * Compute SHA-256 hash of a string.
 * @param {string} input - Input string
 * @returns {Promise<Uint8Array>} Hash bytes
 */
async function sha256(input) {
  const inputBytes = stringToBytes(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', inputBytes);
  return new Uint8Array(hashBuffer);
}

// =============================================================================
// Core PoW Functions
// =============================================================================

/**
 * @typedef {Object} PowChallenge
 * @property {number} difficulty - Number of leading zero bits required
 * @property {string} prefix - Prefix for hash input (e.g., "sealed:")
 */

/**
 * Solve a proof-of-work challenge.
 * Finds a solution where SHA256(prefix + nonce + solution) has `difficulty` leading zero bits.
 * 
 * @param {string} nonce - Server-provided nonce
 * @param {PowChallenge} challenge - Difficulty and prefix
 * @returns {Promise<string>} Solution string (counter value)
 */
async function solveChallenge(nonce, challenge) {
  const { difficulty, prefix = DEFAULT_PREFIX } = challenge;
  
  // Validate inputs
  if (typeof nonce !== 'string' || nonce.length === 0) {
    throw new Error('Invalid nonce: must be a non-empty string');
  }
  if (typeof difficulty !== 'number' || difficulty < 0 || difficulty > 256) {
    throw new Error('Invalid difficulty: must be a number between 0 and 256');
  }
  
  // Trivial case: difficulty 0 always succeeds
  if (difficulty === 0) {
    return '0';
  }
  
  const baseInput = prefix + nonce;
  let counter = 0;
  
  while (true) {
    const input = baseInput + counter.toString();
    const hash = await sha256(input);
    
    if (hasLeadingZeroBits(hash, difficulty)) {
      return counter.toString();
    }
    
    counter++;
    
    // Yield to event loop periodically for UI responsiveness
    // Check every 1000 iterations (balance between performance and responsiveness)
    if (counter % 1000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}

/**
 * Verify a proof-of-work solution.
 * Used for testing; server performs actual verification.
 * 
 * @param {string} nonce - Server-provided nonce
 * @param {string} solution - Proposed solution
 * @param {PowChallenge} challenge - Difficulty and prefix
 * @returns {Promise<boolean>} True if solution is valid
 */
async function verifyChallenge(nonce, solution, challenge) {
  const { difficulty, prefix = DEFAULT_PREFIX } = challenge;
  
  // Validate inputs
  if (typeof nonce !== 'string' || nonce.length === 0) {
    return false;
  }
  if (typeof solution !== 'string') {
    return false;
  }
  if (typeof difficulty !== 'number' || difficulty < 0 || difficulty > 256) {
    return false;
  }
  
  // Trivial case: difficulty 0 always succeeds
  if (difficulty === 0) {
    return true;
  }
  
  const input = prefix + nonce + solution;
  const hash = await sha256(input);
  
  return hasLeadingZeroBits(hash, difficulty);
}

// =============================================================================
// Exports (for both browser and testing)
// =============================================================================

// Check if running in Node.js environment (for testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Core functions
    solveChallenge,
    verifyChallenge,
    
    // Utility functions (exported for testing)
    hasLeadingZeroBits,
    sha256,
    bytesToHex,
    stringToBytes,
    
    // Constants (exported for testing)
    DEFAULT_PREFIX
  };
}
