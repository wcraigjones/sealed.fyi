/**
 * sealed.fyi - Client-side Cryptography Module
 * 
 * Implements AES-256-GCM encryption with optional passphrase protection.
 * All cryptographic operations use the Web Crypto API exclusively.
 * 
 * Security properties:
 * - Keys never leave the browser (passed via URL fragment only)
 * - Server only receives ciphertext
 * - Passphrase protection adds defense-in-depth
 */

// =============================================================================
// Constants
// =============================================================================

const AES_KEY_LENGTH = 256;
const AES_IV_LENGTH = 12;  // 96 bits for GCM
const SALT_LENGTH = 16;    // 128 bits
const PBKDF2_ITERATIONS = 100000;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert a Uint8Array to base64 string.
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
function bytesToBase64(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
}

/**
 * Convert a base64 string to Uint8Array.
 * @param {string} base64 
 * @returns {Uint8Array}
 */
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert a Uint8Array to base64url string (URL-safe, no padding).
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convert a base64url string to Uint8Array.
 * @param {string} base64url 
 * @returns {Uint8Array}
 */
function base64UrlToBytes(base64url) {
  // Add padding if needed
  let base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  
  return base64ToBytes(base64);
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
 * Decode a Uint8Array to UTF-8 string.
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
function bytesToString(bytes) {
  return new TextDecoder().decode(bytes);
}

/**
 * Concatenate multiple Uint8Arrays.
 * @param {...Uint8Array} arrays 
 * @returns {Uint8Array}
 */
function concatBytes(...arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// =============================================================================
// Core Crypto Functions
// =============================================================================

/**
 * Generate a random 256-bit AES key.
 * @returns {Promise<CryptoKey>}
 */
async function generateKey() {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH
    },
    true,  // extractable (needed for URL fragment encoding)
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a random initialization vector (96 bits / 12 bytes).
 * @returns {Uint8Array}
 */
function generateIV() {
  return crypto.getRandomValues(new Uint8Array(AES_IV_LENGTH));
}

/**
 * Generate a random salt (128 bits / 16 bytes).
 * @returns {string} Base64-encoded salt
 */
function generateSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return bytesToBase64(salt);
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * @param {string} plaintext - UTF-8 string to encrypt
 * @param {CryptoKey} key - AES-256 key
 * @returns {Promise<{ciphertext: string, iv: string}>} Base64-encoded ciphertext and IV
 */
async function encrypt(plaintext, key) {
  const iv = generateIV();
  const plaintextBytes = stringToBytes(plaintext);
  
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    plaintextBytes
  );
  
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    iv: bytesToBase64(iv)
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 * @param {string} ciphertext - Base64-encoded ciphertext (includes auth tag)
 * @param {string} iv - Base64-encoded initialization vector
 * @param {CryptoKey} key - AES-256 key
 * @returns {Promise<string>} Decrypted plaintext
 * @throws {Error} If decryption fails (wrong key, tampered data)
 */
async function decrypt(ciphertext, iv, key) {
  const ciphertextBytes = base64ToBytes(ciphertext);
  const ivBytes = base64ToBytes(iv);
  
  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes
    },
    key,
    ciphertextBytes
  );
  
  return bytesToString(new Uint8Array(plaintextBuffer));
}

/**
 * Derive an AES-256 key from a passphrase using PBKDF2.
 * @param {string} passphrase - User-provided passphrase
 * @param {string} salt - Base64-encoded salt
 * @returns {Promise<CryptoKey>} Derived AES-256 key
 */
async function deriveKeyFromPassphrase(passphrase, salt) {
  const passphraseBytes = stringToBytes(passphrase);
  const saltBytes = base64ToBytes(salt);
  
  // Import passphrase as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // Derive AES key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH
    },
    true,  // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to base64url for URL fragment.
 * @param {CryptoKey} key - AES-256 key
 * @returns {Promise<string>} Base64url-encoded raw key bytes
 */
async function keyToBase64Url(key) {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return bytesToBase64Url(new Uint8Array(rawKey));
}

/**
 * Import a CryptoKey from base64url.
 * @param {string} encoded - Base64url-encoded raw key bytes
 * @returns {Promise<CryptoKey>} AES-256 key
 */
async function base64UrlToKey(encoded) {
  const keyBytes = base64UrlToBytes(encoded);
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Import a non-extractable CryptoKey from base64url for decryption.
 * @param {string} encoded - Base64url-encoded raw key bytes
 * @returns {Promise<CryptoKey>} AES-256 key
 */
async function base64UrlToNonExtractableKey(encoded) {
  const keyBytes = base64UrlToBytes(encoded);
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH
    },
    false,
    ['decrypt']
  );
}

// =============================================================================
// High-Level API
// =============================================================================

/**
 * Encrypt a secret for storage.
 * Optionally adds passphrase protection via key wrapping.
 * 
 * @param {string} plaintext - Secret content
 * @param {string} [passphrase] - Optional additional passphrase
 * @returns {Promise<{payload: {ciphertext: string, iv: string, salt: string|null}, urlFragment: string}>}
 */
async function encryptSecret(plaintext, passphrase) {
  // Generate random content key
  const contentKey = await generateKey();
  
  // Encrypt the plaintext with content key
  const { ciphertext, iv } = await encrypt(plaintext, contentKey);
  
  if (!passphrase) {
    // No passphrase: encode content key directly in URL fragment
    const urlFragment = await keyToBase64Url(contentKey);
    return {
      payload: {
        ciphertext,
        iv,
        salt: null
      },
      urlFragment
    };
  }
  
  // With passphrase: wrap the content key
  const salt = generateSalt();
  const wrappingKey = await deriveKeyFromPassphrase(passphrase, salt);
  
  // Export content key for wrapping
  const contentKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', contentKey));
  
  // Wrap the content key using AES-GCM
  const wrappingIV = generateIV();
  const wrappedKeyBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: wrappingIV
    },
    wrappingKey,
    contentKeyBytes
  );
  
  // URL fragment = wrappingIV || wrappedKey (includes auth tag)
  const wrappedKeyBytes = new Uint8Array(wrappedKeyBuffer);
  const fragmentBytes = concatBytes(wrappingIV, wrappedKeyBytes);
  const urlFragment = bytesToBase64Url(fragmentBytes);
  
  return {
    payload: {
      ciphertext,
      iv,
      salt
    },
    urlFragment
  };
}

/**
 * Decrypt a secret retrieved from server.
 * 
 * @param {{ciphertext: string, iv: string, salt: string|null}} payload - Encrypted payload from server
 * @param {string} urlFragment - Key material from URL fragment
 * @param {string} [passphrase] - Required if payload.salt is present
 * @returns {Promise<string>} Decrypted plaintext
 * @throws {Error} If decryption fails
 */
async function decryptSecret(payload, urlFragment, passphrase) {
  const { ciphertext, iv, salt } = payload;
  
  let contentKey;
  
  if (!salt) {
    // No passphrase: URL fragment is the content key
    contentKey = await base64UrlToNonExtractableKey(urlFragment);
  } else {
    // With passphrase: unwrap the content key
    if (!passphrase) {
      throw new Error('Passphrase required for this secret');
    }
    
    const wrappingKey = await deriveKeyFromPassphrase(passphrase, salt);
    
    // Parse URL fragment: wrappingIV || wrappedKey
    const fragmentBytes = base64UrlToBytes(urlFragment);
    const wrappingIV = fragmentBytes.slice(0, AES_IV_LENGTH);
    const wrappedKeyBytes = fragmentBytes.slice(AES_IV_LENGTH);
    
    // Unwrap the content key
    const contentKeyBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: wrappingIV
      },
      wrappingKey,
      wrappedKeyBytes
    );
    
    // Import unwrapped key
    contentKey = await crypto.subtle.importKey(
      'raw',
      contentKeyBuffer,
      {
        name: 'AES-GCM',
        length: AES_KEY_LENGTH
      },
      false,
      ['decrypt']
    );
  }
  
  // Decrypt the ciphertext with content key
  return decrypt(ciphertext, iv, contentKey);
}

// =============================================================================
// Exports (for both browser and testing)
// =============================================================================

// Check if running in Node.js environment (for testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Core functions
    generateKey,
    generateIV,
    generateSalt,
    encrypt,
    decrypt,
    deriveKeyFromPassphrase,
    keyToBase64Url,
    base64UrlToKey,
    base64UrlToNonExtractableKey,
    
    // High-level API
    encryptSecret,
    decryptSecret,
    
    // Utility functions (exported for testing)
    bytesToBase64,
    base64ToBytes,
    bytesToBase64Url,
    base64UrlToBytes,
    stringToBytes,
    bytesToString,
    concatBytes,
    
    // Constants (exported for testing)
    AES_KEY_LENGTH,
    AES_IV_LENGTH,
    SALT_LENGTH,
    PBKDF2_ITERATIONS
  };
}
