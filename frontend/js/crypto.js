/**
 * sealed.fyi Crypto Library
 * 
 * Client-side encryption using Web Crypto API.
 * Keys never leave the browser - only ciphertext is sent to server.
 */

// ============ CONSTANTS ============

const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const SALT_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000;

// ============ UTILITY FUNCTIONS ============

/**
 * Convert a Uint8Array to base64 string.
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
function bytesToBase64(bytes) {
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binString);
}

/**
 * Convert a base64 string to Uint8Array.
 * @param {string} base64 
 * @returns {Uint8Array}
 */
function base64ToBytes(base64) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (char) => char.charCodeAt(0));
}

/**
 * Convert a Uint8Array to base64url string (URL-safe, no padding).
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
function bytesToBase64Url(bytes) {
  const base64 = bytesToBase64(bytes);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert a base64url string to Uint8Array.
 * @param {string} base64url 
 * @returns {Uint8Array}
 */
function base64UrlToBytes(base64url) {
  // Add padding if needed
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (base64.length % 4)) % 4;
  base64 += '='.repeat(padding);
  return base64ToBytes(base64);
}

/**
 * Encode a string to UTF-8 bytes.
 * @param {string} str 
 * @returns {Uint8Array}
 */
function stringToBytes(str) {
  return new TextEncoder().encode(str);
}

/**
 * Decode UTF-8 bytes to string.
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
function bytesToString(bytes) {
  return new TextDecoder().decode(bytes);
}

// ============ KEY GENERATION ============

/**
 * Generate a random 256-bit AES key.
 * Uses CSPRNG via Web Crypto API.
 * @returns {Promise<CryptoKey>}
 */
async function generateKey() {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH
    },
    true, // extractable (needed for URL fragment encoding)
    ['encrypt', 'decrypt']
  );
}

// ============ ENCRYPTION ============

/**
 * Encrypt plaintext using AES-256-GCM.
 * Generates a random 96-bit IV for each encryption.
 * 
 * @param {string} plaintext - UTF-8 string to encrypt
 * @param {CryptoKey} key - AES-256 CryptoKey
 * @returns {Promise<{ciphertext: string, iv: string}>} Ciphertext and IV, both base64-encoded
 */
async function encrypt(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
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

// ============ DECRYPTION ============

/**
 * Decrypt ciphertext using AES-256-GCM.
 * 
 * @param {string} ciphertext - Base64-encoded ciphertext (includes auth tag)
 * @param {string} iv - Base64-encoded initialization vector
 * @param {CryptoKey} key - AES-256 CryptoKey
 * @returns {Promise<string>} Decrypted plaintext as UTF-8 string
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

// ============ PASSPHRASE KEY DERIVATION ============

/**
 * Derive an AES-256 key from a passphrase using PBKDF2.
 * 
 * @param {string} passphrase - User-provided passphrase
 * @param {string} salt - Base64-encoded salt (16 bytes)
 * @returns {Promise<CryptoKey>} Derived AES-256 CryptoKey
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
    ['deriveBits', 'deriveKey']
  );
  
  // Derive AES key using PBKDF2
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
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

// ============ SALT GENERATION ============

/**
 * Generate a random 128-bit salt for key derivation.
 * 
 * @returns {string} Base64-encoded salt (16 bytes)
 */
function generateSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return bytesToBase64(salt);
}

// ============ KEY ENCODING (URL FRAGMENT) ============

/**
 * Export a CryptoKey to base64url for URL fragment.
 * 
 * @param {CryptoKey} key - AES-256 CryptoKey
 * @returns {Promise<string>} Base64url-encoded raw key bytes
 */
async function keyToBase64Url(key) {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return bytesToBase64Url(new Uint8Array(rawKey));
}

/**
 * Import a CryptoKey from base64url.
 * 
 * @param {string} encoded - Base64url-encoded raw key bytes
 * @returns {Promise<CryptoKey>} AES-256 CryptoKey
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

// ============ HIGH-LEVEL API ============

/**
 * Encrypt a secret for storage.
 * Optionally adds passphrase protection.
 * 
 * Without passphrase:
 *   - URL fragment contains the raw content key
 * 
 * With passphrase:
 *   - URL fragment contains wrappingIV + wrappedKey (key encrypted with passphrase-derived key)
 *   - Salt is included in payload for server storage
 * 
 * @param {string} plaintext - Secret content
 * @param {string} [passphrase] - Optional additional passphrase
 * @returns {Promise<{payload: {ciphertext: string, iv: string, salt: string|null}, urlFragment: string}>}
 */
async function encryptSecret(plaintext, passphrase) {
  // Generate random content key
  const contentKey = await generateKey();
  
  // Encrypt plaintext with content key
  const { ciphertext, iv } = await encrypt(plaintext, contentKey);
  
  if (!passphrase) {
    // No passphrase: URL fragment is just the content key
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
  
  // Export content key as raw bytes for wrapping
  const rawContentKey = await crypto.subtle.exportKey('raw', contentKey);
  
  // Generate IV for key wrapping
  const wrappingIv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Wrap (encrypt) the content key using AES-GCM
  const wrappedKeyBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: wrappingIv
    },
    wrappingKey,
    rawContentKey
  );
  
  // Combine wrappingIV + wrappedKey for URL fragment
  const wrappedKeyBytes = new Uint8Array(wrappedKeyBuffer);
  const fragmentBytes = new Uint8Array(IV_LENGTH + wrappedKeyBytes.length);
  fragmentBytes.set(wrappingIv, 0);
  fragmentBytes.set(wrappedKeyBytes, IV_LENGTH);
  
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
 * @param {Object} payload - Encrypted payload from server
 * @param {string} payload.ciphertext - Base64-encoded ciphertext
 * @param {string} payload.iv - Base64-encoded IV
 * @param {string|null} payload.salt - Base64-encoded salt (if passphrase-protected)
 * @param {string} urlFragment - Key material from URL fragment
 * @param {string} [passphrase] - Required if payload.salt is present
 * @returns {Promise<string>} Decrypted plaintext
 * @throws {Error} If decryption fails
 */
async function decryptSecret(payload, urlFragment, passphrase) {
  const { ciphertext, iv, salt } = payload;
  
  let contentKey;
  
  if (!salt) {
    // No passphrase: URL fragment is the raw content key
    contentKey = await base64UrlToKey(urlFragment);
  } else {
    // With passphrase: unwrap the content key
    if (!passphrase) {
      throw new Error('Passphrase required for this secret');
    }
    
    // Derive wrapping key from passphrase
    const wrappingKey = await deriveKeyFromPassphrase(passphrase, salt);
    
    // Decode fragment: wrappingIV + wrappedKey
    const fragmentBytes = base64UrlToBytes(urlFragment);
    const wrappingIv = fragmentBytes.slice(0, IV_LENGTH);
    const wrappedKey = fragmentBytes.slice(IV_LENGTH);
    
    // Unwrap (decrypt) the content key
    const rawContentKey = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: wrappingIv
      },
      wrappingKey,
      wrappedKey
    );
    
    // Import content key
    contentKey = await crypto.subtle.importKey(
      'raw',
      rawContentKey,
      {
        name: 'AES-GCM',
        length: AES_KEY_LENGTH
      },
      true,
      ['encrypt', 'decrypt']
    );
  }
  
  // Decrypt ciphertext with content key
  return decrypt(ciphertext, iv, contentKey);
}

// ============ EXPORTS ============

// For browser usage (global)
if (typeof window !== 'undefined') {
  window.SealedCrypto = {
    // Core functions
    generateKey,
    encrypt,
    decrypt,
    deriveKeyFromPassphrase,
    generateSalt,
    keyToBase64Url,
    base64UrlToKey,
    
    // High-level API
    encryptSecret,
    decryptSecret,
    
    // Utilities (exposed for testing)
    bytesToBase64,
    base64ToBytes,
    bytesToBase64Url,
    base64UrlToBytes,
    
    // Constants (exposed for testing)
    AES_KEY_LENGTH,
    IV_LENGTH,
    SALT_LENGTH,
    PBKDF2_ITERATIONS
  };
}

// For Node.js/testing (ES modules or CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Core functions
    generateKey,
    encrypt,
    decrypt,
    deriveKeyFromPassphrase,
    generateSalt,
    keyToBase64Url,
    base64UrlToKey,
    
    // High-level API
    encryptSecret,
    decryptSecret,
    
    // Utilities (exposed for testing)
    bytesToBase64,
    base64ToBytes,
    bytesToBase64Url,
    base64UrlToBytes,
    
    // Constants (exposed for testing)
    AES_KEY_LENGTH,
    IV_LENGTH,
    SALT_LENGTH,
    PBKDF2_ITERATIONS
  };
}
