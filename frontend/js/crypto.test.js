/**
 * sealed.fyi - Crypto Library Tests
 * 
 * Run with: npx vitest run crypto.test.js
 * Or in watch mode: npx vitest crypto.test.js
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';

// Polyfill Web Crypto API for Node.js
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto;
}

// Import the crypto module
const {
  generateKey,
  generateIV,
  generateSalt,
  encrypt,
  decrypt,
  deriveKeyFromPassphrase,
  keyToBase64Url,
  base64UrlToKey,
  base64UrlToNonExtractableKey,
  encryptSecret,
  decryptSecret,
  bytesToBase64,
  base64ToBytes,
  bytesToBase64Url,
  base64UrlToBytes,
  stringToBytes,
  bytesToString,
  AES_KEY_LENGTH,
  AES_IV_LENGTH,
  SALT_LENGTH
} = await import('./crypto.js');

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('Utility Functions', () => {
  describe('base64 encoding', () => {
    test('bytesToBase64 and base64ToBytes round-trip', () => {
      const original = new Uint8Array([0, 1, 2, 255, 128, 64]);
      const encoded = bytesToBase64(original);
      const decoded = base64ToBytes(encoded);
      expect(decoded).toEqual(original);
    });
    
    test('handles empty array', () => {
      const original = new Uint8Array([]);
      const encoded = bytesToBase64(original);
      const decoded = base64ToBytes(encoded);
      expect(decoded).toEqual(original);
    });
  });
  
  describe('base64url encoding', () => {
    test('bytesToBase64Url and base64UrlToBytes round-trip', () => {
      const original = new Uint8Array([0, 1, 2, 255, 128, 64, 63, 62]);
      const encoded = bytesToBase64Url(original);
      const decoded = base64UrlToBytes(encoded);
      expect(decoded).toEqual(original);
    });
    
    test('output is URL-safe (no +, /, =)', () => {
      // Test with bytes that would produce + and / in standard base64
      const bytes = new Uint8Array([251, 255, 254, 253]);
      const encoded = bytesToBase64Url(bytes);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });
    
    test('32-byte key produces correct length (43 chars)', () => {
      const key32 = new Uint8Array(32);
      crypto.getRandomValues(key32);
      const encoded = bytesToBase64Url(key32);
      expect(encoded.length).toBe(43);
    });
  });
  
  describe('string encoding', () => {
    test('stringToBytes and bytesToString round-trip', () => {
      const original = 'Hello, World!';
      const bytes = stringToBytes(original);
      const decoded = bytesToString(bytes);
      expect(decoded).toBe(original);
    });
    
    test('handles unicode characters', () => {
      const original = '你好世界 🔐 émojis';
      const bytes = stringToBytes(original);
      const decoded = bytesToString(bytes);
      expect(decoded).toBe(original);
    });
    
    test('handles empty string', () => {
      const original = '';
      const bytes = stringToBytes(original);
      const decoded = bytesToString(bytes);
      expect(decoded).toBe(original);
    });
  });
});

// =============================================================================
// Key Generation Tests
// =============================================================================

describe('Key Generation', () => {
  describe('generateKey', () => {
    test('generates a 256-bit AES key', async () => {
      const key = await generateKey();
      expect(key.algorithm.name).toBe('AES-GCM');
      expect(key.algorithm.length).toBe(256);
    });
    
    test('key is extractable', async () => {
      const key = await generateKey();
      expect(key.extractable).toBe(true);
    });
    
    test('key has correct usages (encrypt, decrypt)', async () => {
      const key = await generateKey();
      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });
    
    test('generates unique keys on each call', async () => {
      const key1 = await generateKey();
      const key2 = await generateKey();
      
      const raw1 = await crypto.subtle.exportKey('raw', key1);
      const raw2 = await crypto.subtle.exportKey('raw', key2);
      
      expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
    });
  });
  
  describe('generateIV', () => {
    test('generates 12-byte IV', () => {
      const iv = generateIV();
      expect(iv.length).toBe(AES_IV_LENGTH);
      expect(iv.length).toBe(12);
    });
    
    test('generates unique IVs', () => {
      const iv1 = generateIV();
      const iv2 = generateIV();
      expect(iv1).not.toEqual(iv2);
    });
  });
  
  describe('generateSalt', () => {
    test('generates base64-encoded 16-byte salt', () => {
      const salt = generateSalt();
      const bytes = base64ToBytes(salt);
      expect(bytes.length).toBe(SALT_LENGTH);
      expect(bytes.length).toBe(16);
    });
    
    test('generates unique salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toBe(salt2);
    });
  });
});

// =============================================================================
// Encryption/Decryption Tests
// =============================================================================

describe('Encryption and Decryption', () => {
  describe('encrypt/decrypt', () => {
    test('round-trip preserves plaintext', async () => {
      const key = await generateKey();
      const plaintext = 'Hello, World!';
      
      const { ciphertext, iv } = await encrypt(plaintext, key);
      const decrypted = await decrypt(ciphertext, iv, key);
      
      expect(decrypted).toBe(plaintext);
    });
    
    test('encrypts empty string', async () => {
      const key = await generateKey();
      const plaintext = '';
      
      const { ciphertext, iv } = await encrypt(plaintext, key);
      const decrypted = await decrypt(ciphertext, iv, key);
      
      expect(decrypted).toBe(plaintext);
    });
    
    test('encrypts unicode characters', async () => {
      const key = await generateKey();
      const plaintext = '你好世界 🔐 émojis ñ';
      
      const { ciphertext, iv } = await encrypt(plaintext, key);
      const decrypted = await decrypt(ciphertext, iv, key);
      
      expect(decrypted).toBe(plaintext);
    });
    
    test('encrypts large payload (50KB)', async () => {
      const key = await generateKey();
      const plaintext = 'x'.repeat(50 * 1024);
      
      const { ciphertext, iv } = await encrypt(plaintext, key);
      const decrypted = await decrypt(ciphertext, iv, key);
      
      expect(decrypted).toBe(plaintext);
    });
    
    test('generates unique IV for each encryption', async () => {
      const key = await generateKey();
      const plaintext = 'Same message';
      
      const result1 = await encrypt(plaintext, key);
      const result2 = await encrypt(plaintext, key);
      
      expect(result1.iv).not.toBe(result2.iv);
    });
    
    test('same plaintext produces different ciphertext (due to IV)', async () => {
      const key = await generateKey();
      const plaintext = 'Same message';
      
      const result1 = await encrypt(plaintext, key);
      const result2 = await encrypt(plaintext, key);
      
      expect(result1.ciphertext).not.toBe(result2.ciphertext);
    });
  });
  
  describe('decrypt failures', () => {
    test('wrong key throws error', async () => {
      const key1 = await generateKey();
      const key2 = await generateKey();
      const plaintext = 'Secret message';
      
      const { ciphertext, iv } = await encrypt(plaintext, key1);
      
      await expect(decrypt(ciphertext, iv, key2)).rejects.toThrow();
    });
    
    test('tampered ciphertext throws error', async () => {
      const key = await generateKey();
      const plaintext = 'Secret message';
      
      const { ciphertext, iv } = await encrypt(plaintext, key);
      
      // Tamper with ciphertext
      const bytes = base64ToBytes(ciphertext);
      bytes[0] ^= 0xFF;
      const tamperedCiphertext = bytesToBase64(bytes);
      
      await expect(decrypt(tamperedCiphertext, iv, key)).rejects.toThrow();
    });
    
    test('tampered IV throws error', async () => {
      const key = await generateKey();
      const plaintext = 'Secret message';
      
      const { ciphertext, iv } = await encrypt(plaintext, key);
      
      // Tamper with IV
      const bytes = base64ToBytes(iv);
      bytes[0] ^= 0xFF;
      const tamperedIV = bytesToBase64(bytes);
      
      await expect(decrypt(ciphertext, tamperedIV, key)).rejects.toThrow();
    });
    
    test('truncated ciphertext throws error', async () => {
      const key = await generateKey();
      const plaintext = 'Secret message';
      
      const { ciphertext, iv } = await encrypt(plaintext, key);
      
      // Truncate ciphertext
      const bytes = base64ToBytes(ciphertext);
      const truncated = bytes.slice(0, bytes.length - 5);
      const truncatedCiphertext = bytesToBase64(truncated);
      
      await expect(decrypt(truncatedCiphertext, iv, key)).rejects.toThrow();
    });
    
    test('invalid base64 throws error', async () => {
      const key = await generateKey();
      const { iv } = await encrypt('test', key);
      
      await expect(decrypt('not-valid-base64!!!', iv, key)).rejects.toThrow();
    });
  });
});

// =============================================================================
// Passphrase Key Derivation Tests
// =============================================================================

describe('Passphrase Key Derivation', () => {
  describe('deriveKeyFromPassphrase', () => {
    test('same passphrase + salt produces same key', async () => {
      const passphrase = 'my-secret-passphrase';
      const salt = generateSalt();
      
      const key1 = await deriveKeyFromPassphrase(passphrase, salt);
      const key2 = await deriveKeyFromPassphrase(passphrase, salt);
      
      const raw1 = await crypto.subtle.exportKey('raw', key1);
      const raw2 = await crypto.subtle.exportKey('raw', key2);
      
      expect(new Uint8Array(raw1)).toEqual(new Uint8Array(raw2));
    });
    
    test('different passphrase produces different key', async () => {
      const salt = generateSalt();
      
      const key1 = await deriveKeyFromPassphrase('passphrase1', salt);
      const key2 = await deriveKeyFromPassphrase('passphrase2', salt);
      
      const raw1 = await crypto.subtle.exportKey('raw', key1);
      const raw2 = await crypto.subtle.exportKey('raw', key2);
      
      expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
    });
    
    test('different salt produces different key', async () => {
      const passphrase = 'same-passphrase';
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      
      const key1 = await deriveKeyFromPassphrase(passphrase, salt1);
      const key2 = await deriveKeyFromPassphrase(passphrase, salt2);
      
      const raw1 = await crypto.subtle.exportKey('raw', key1);
      const raw2 = await crypto.subtle.exportKey('raw', key2);
      
      expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
    });
    
    test('empty passphrase works', async () => {
      const salt = generateSalt();
      const key = await deriveKeyFromPassphrase('', salt);
      
      expect(key.algorithm.name).toBe('AES-GCM');
      expect(key.algorithm.length).toBe(256);
    });
    
    test('unicode passphrase works', async () => {
      const salt = generateSalt();
      const key = await deriveKeyFromPassphrase('密码🔑émoji', salt);
      
      expect(key.algorithm.name).toBe('AES-GCM');
    });
    
    test('long passphrase works (1000 chars)', async () => {
      const salt = generateSalt();
      const passphrase = 'x'.repeat(1000);
      const key = await deriveKeyFromPassphrase(passphrase, salt);
      
      expect(key.algorithm.name).toBe('AES-GCM');
    });
  });
});

// =============================================================================
// Key Encoding Tests
// =============================================================================

describe('Key Encoding', () => {
  describe('keyToBase64Url / base64UrlToKey', () => {
    test('round-trip preserves key', async () => {
      const key = await generateKey();
      const encoded = await keyToBase64Url(key);
      const decoded = await base64UrlToKey(encoded);
      
      const original = await crypto.subtle.exportKey('raw', key);
      const restored = await crypto.subtle.exportKey('raw', decoded);
      
      expect(new Uint8Array(restored)).toEqual(new Uint8Array(original));
    });
    
    test('output is URL-safe (no +, /, =)', async () => {
      // Generate multiple keys to increase chance of special chars
      for (let i = 0; i < 10; i++) {
        const key = await generateKey();
        const encoded = await keyToBase64Url(key);
        
        expect(encoded).not.toContain('+');
        expect(encoded).not.toContain('/');
        expect(encoded).not.toContain('=');
      }
    });
    
    test('output is correct length (43 chars for 32 bytes)', async () => {
      const key = await generateKey();
      const encoded = await keyToBase64Url(key);
      
      // 32 bytes = 256 bits = 43 base64url chars (without padding)
      expect(encoded.length).toBe(43);
    });
  });

  describe('base64UrlToNonExtractableKey', () => {
    test('key is not extractable', async () => {
      const key = await generateKey();
      const encoded = await keyToBase64Url(key);
      const decoded = await base64UrlToNonExtractableKey(encoded);
      
      expect(decoded.extractable).toBe(false);
    });
    
    test('key has correct usages (decrypt only)', async () => {
      const key = await generateKey();
      const encoded = await keyToBase64Url(key);
      const decoded = await base64UrlToNonExtractableKey(encoded);

      expect(decoded.usages).toEqual(['decrypt']);
    });
  });
});

// =============================================================================
// High-Level API Tests
// =============================================================================

describe('High-Level API', () => {
  describe('encryptSecret', () => {
    test('returns payload and urlFragment', async () => {
      const plaintext = 'My secret message';
      const result = await encryptSecret(plaintext);
      
      expect(result).toHaveProperty('payload');
      expect(result).toHaveProperty('urlFragment');
    });
    
    test('payload contains ciphertext and iv', async () => {
      const plaintext = 'My secret message';
      const { payload } = await encryptSecret(plaintext);
      
      expect(payload).toHaveProperty('ciphertext');
      expect(payload).toHaveProperty('iv');
      expect(typeof payload.ciphertext).toBe('string');
      expect(typeof payload.iv).toBe('string');
    });
    
    test('urlFragment is valid base64url', async () => {
      const plaintext = 'My secret message';
      const { urlFragment } = await encryptSecret(plaintext);
      
      expect(urlFragment).not.toContain('+');
      expect(urlFragment).not.toContain('/');
      expect(urlFragment).not.toContain('=');
      
      // Should be decodable
      const bytes = base64UrlToBytes(urlFragment);
      expect(bytes.length).toBeGreaterThan(0);
    });
    
    test('without passphrase: salt is null', async () => {
      const { payload } = await encryptSecret('test');
      expect(payload.salt).toBeNull();
    });
    
    test('with passphrase: payload contains salt', async () => {
      const { payload } = await encryptSecret('test', 'my-passphrase');
      expect(payload.salt).not.toBeNull();
      expect(typeof payload.salt).toBe('string');
      
      // Salt should be 16 bytes when decoded
      const saltBytes = base64ToBytes(payload.salt);
      expect(saltBytes.length).toBe(16);
    });
  });
  
  describe('decryptSecret', () => {
    test('decrypts secret encrypted without passphrase', async () => {
      const plaintext = 'My secret message';
      const { payload, urlFragment } = await encryptSecret(plaintext);
      
      const decrypted = await decryptSecret(payload, urlFragment);
      expect(decrypted).toBe(plaintext);
    });
    
    test('decrypts secret encrypted with passphrase', async () => {
      const plaintext = 'My secret message';
      const passphrase = 'my-passphrase';
      
      const { payload, urlFragment } = await encryptSecret(plaintext, passphrase);
      const decrypted = await decryptSecret(payload, urlFragment, passphrase);
      
      expect(decrypted).toBe(plaintext);
    });
    
    test('wrong passphrase throws error', async () => {
      const plaintext = 'My secret message';
      const { payload, urlFragment } = await encryptSecret(plaintext, 'correct-passphrase');
      
      await expect(
        decryptSecret(payload, urlFragment, 'wrong-passphrase')
      ).rejects.toThrow();
    });
    
    test('missing passphrase for protected secret throws error', async () => {
      const { payload, urlFragment } = await encryptSecret('test', 'my-passphrase');
      
      await expect(
        decryptSecret(payload, urlFragment)
      ).rejects.toThrow('Passphrase required');
    });
    
    test('handles unicode content', async () => {
      const plaintext = '你好世界 🔐 émojis';
      const passphrase = '密码🔑';
      
      const { payload, urlFragment } = await encryptSecret(plaintext, passphrase);
      const decrypted = await decryptSecret(payload, urlFragment, passphrase);
      
      expect(decrypted).toBe(plaintext);
    });
    
    test('handles large content (50KB)', async () => {
      const plaintext = 'x'.repeat(50 * 1024);
      
      const { payload, urlFragment } = await encryptSecret(plaintext);
      const decrypted = await decryptSecret(payload, urlFragment);
      
      expect(decrypted).toBe(plaintext);
    });
  });
});
