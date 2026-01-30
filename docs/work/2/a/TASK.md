# Phase 2, Stream A: Crypto Library

## Goal
Implement the client-side crypto library using Web Crypto API.

## Files
- `frontend/js/crypto.js`
- `frontend/js/crypto.test.js`

## Scope
- AES-256-GCM encryption/decryption
- PBKDF2-SHA256 key derivation (100,000 iterations) for passphrase protection
- Base64url encoding for URL fragment
- All functions per contract in `docs/CRYPTO.md`

## Functions to Implement

```javascript
// Key generation
async function generateKey(): Promise<CryptoKey>

// Encryption (AES-256-GCM)
async function encrypt(plaintext: string, key: CryptoKey): Promise<{ ciphertext: Uint8Array, iv: Uint8Array }>

// Decryption
async function decrypt(ciphertext: Uint8Array, iv: Uint8Array, key: CryptoKey): Promise<string>

// Passphrase derivation (PBKDF2)
async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey>

// Salt generation
function generateSalt(): Uint8Array

// URL fragment encoding (base64url)
async function keyToBase64Url(key: CryptoKey): Promise<string>
async function base64UrlToKey(encoded: string): Promise<CryptoKey>

// High-level API
async function encryptSecret(plaintext: string, passphrase?: string): Promise<{ payload, urlFragment }>
async function decryptSecret(payload, urlFragment: string, passphrase?: string): Promise<string>
```

## Tests Required
- Encrypt/decrypt round-trip
- Passphrase derivation determinism (same passphrase + salt = same key)
- Base64url encoding round-trip
- Decryption fails with wrong key
- Decryption fails with wrong passphrase

## Dependencies
- None (uses browser Web Crypto API only)

## Exit Criteria
- [x] All functions implemented
- [x] All tests passing (47 tests)
- [x] Code reviewed

## Completed

- **Date:** 2026-01-30
- **Summary:** Implemented complete crypto library with all functions per contract.
  
  **Implemented:**
  - Core functions: generateKey, generateIV, generateSalt, encrypt, decrypt
  - Key derivation: deriveKeyFromPassphrase (PBKDF2-SHA256, 100k iterations)
  - Key encoding: keyToBase64Url, base64UrlToKey
  - High-level API: encryptSecret, decryptSecret (with passphrase key wrapping)
  - Utility functions: base64/base64url encoding, string encoding, byte concatenation
  
  **Test Coverage (47 tests):**
  - Utility functions (base64, base64url, string encoding)
  - Key generation (uniqueness, extractability, usages)
  - Encryption/decryption (round-trip, unicode, 50KB payload, failure cases)
  - Passphrase derivation (determinism, different salt/passphrase)
  - Key encoding (round-trip, URL-safe output, correct length)
  - High-level API (with/without passphrase, error cases)
  
  **Security Notes:**
  - All crypto via Web Crypto API (no polyfills)
  - Keys are extractable only when needed for URL fragment
  - IVs generated randomly for each encryption
  - Passphrase key wrapping uses AES-GCM
  - 100,000 PBKDF2 iterations for brute-force resistance