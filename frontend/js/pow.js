/**
 * Proof-of-Work Library for sealed.fyi
 *
 * Implements SHA-256 hashcash-style proof-of-work for anti-abuse.
 * Algorithm: Find counter where SHA256(prefix + nonce + counter) has N leading zero bits.
 *
 * Uses Web Crypto API for SHA-256 hashing.
 */

/**
 * @typedef {Object} PowChallenge
 * @property {number} difficulty - Number of leading zero bits required
 * @property {string} prefix - Challenge prefix (e.g., "sealed:")
 */

/**
 * Convert a hex string to a Uint8Array
 * @param {string} hex - Hex string
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert a Uint8Array to a hex string
 * @param {Uint8Array} bytes - Byte array
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check if a hash has the required number of leading zero bits
 * @param {Uint8Array} hash - The hash bytes
 * @param {number} difficulty - Required number of leading zero bits
 * @returns {boolean}
 */
function hasLeadingZeroBits(hash, difficulty) {
  let zeroBits = 0;

  for (let i = 0; i < hash.length && zeroBits < difficulty; i++) {
    const byte = hash[i];
    if (byte === 0) {
      zeroBits += 8;
    } else {
      // Count leading zeros in this byte
      for (let bit = 7; bit >= 0; bit--) {
        if ((byte & (1 << bit)) === 0) {
          zeroBits++;
        } else {
          return zeroBits >= difficulty;
        }
      }
    }
  }

  return zeroBits >= difficulty;
}

/**
 * Compute SHA-256 hash using Web Crypto API
 * @param {string} input - Input string to hash
 * @returns {Promise<Uint8Array>} Hash bytes
 */
async function sha256(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

/**
 * Solve a proof-of-work challenge
 *
 * Finds a counter value such that SHA256(prefix + nonce + counter) has at least
 * `difficulty` leading zero bits.
 *
 * @param {string} nonce - Server-provided nonce (hex string)
 * @param {PowChallenge} challenge - Challenge parameters
 * @returns {Promise<string>} Solution (counter value as string)
 */
async function solveChallenge(nonce, challenge) {
  const { difficulty, prefix } = challenge;

  if (typeof difficulty !== 'number' || difficulty < 0 || difficulty > 256) {
    throw new Error('Invalid difficulty: must be between 0 and 256');
  }

  if (typeof prefix !== 'string') {
    throw new Error('Invalid prefix: must be a string');
  }

  if (typeof nonce !== 'string') {
    throw new Error('Invalid nonce: must be a string');
  }

  const baseInput = prefix + nonce;
  const encoder = new TextEncoder();

  let counter = 0;
  const BATCH_SIZE = 1000;

  while (true) {
    // Process a batch synchronously to reduce async overhead
    for (let i = 0; i < BATCH_SIZE; i++) {
      const input = baseInput + counter.toString();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hash = new Uint8Array(hashBuffer);

      if (hasLeadingZeroBits(hash, difficulty)) {
        return counter.toString();
      }

      counter++;
    }

    // Yield to event loop periodically to avoid blocking UI
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Verify a proof-of-work solution
 *
 * Checks that SHA256(prefix + nonce + solution) has at least `difficulty` leading zero bits.
 *
 * @param {string} nonce - Server-provided nonce
 * @param {string} solution - The solution to verify
 * @param {PowChallenge} challenge - Challenge parameters
 * @returns {Promise<boolean>} True if the solution is valid
 */
async function verifyChallenge(nonce, solution, challenge) {
  const { difficulty, prefix } = challenge;

  if (typeof difficulty !== 'number' || difficulty < 0 || difficulty > 256) {
    return false;
  }

  if (typeof prefix !== 'string' || typeof nonce !== 'string' || typeof solution !== 'string') {
    return false;
  }

  const input = prefix + nonce + solution;
  const hash = await sha256(input);

  return hasLeadingZeroBits(hash, difficulty);
}

/**
 * Count the number of leading zero bits in a hash
 * Useful for debugging and performance benchmarking
 *
 * @param {Uint8Array} hash - The hash bytes
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

// Export for module environments (Node.js, bundlers)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    solveChallenge,
    verifyChallenge,
    // Internal utilities exported for testing
    sha256,
    hasLeadingZeroBits,
    countLeadingZeroBits,
    hexToBytes,
    bytesToHex,
  };
}
