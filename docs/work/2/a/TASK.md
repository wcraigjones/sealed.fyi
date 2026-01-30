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
- [x] All tests passing
- [x] Code reviewed

## Completed
- **Date:** 2026-01-30
- **Summary:** Implemented crypto.js with all required functions per contract in docs/CRYPTO.md. All 34 unit tests pass.
- **Files Created:**
  - `frontend/js/crypto.js` - Full crypto library implementation
  - `frontend/js/crypto.test.js` - Comprehensive test suite
- **Implementation Details:**
  - AES-256-GCM encryption/decryption with random IV per operation
  - PBKDF2-SHA256 key derivation (100,000 iterations)
  - Base64url encoding for URL-safe key transport
  - High-level API (encryptSecret/decryptSecret) with optional passphrase protection
  - Key wrapping for passphrase-protected secrets (wrappingIV + wrappedKey in URL fragment)
  - All keys extractable for URL fragment encoding
  - Both browser (window.SealedCrypto) and Node.js (module.exports) exports
- **Test Coverage:**
  - Utility functions (base64, base64url encoding)
  - Key generation (uniqueness, algorithm verification)
  - Encrypt/decrypt round-trips (text, Unicode, empty, large, whitespace)
  - Tamper detection (wrong key, wrong IV, modified ciphertext)
  - Passphrase derivation (determinism, salt variation, cross-passphrase uniqueness)
  - High-level API (with/without passphrase, error handling)
- **Notes:** Mega-review CLI tools not available in environment; manual review completed. Consider adding Web Worker support for PoW operations in future iteration (separate stream 2B).
