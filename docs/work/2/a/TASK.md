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
- [ ] All functions implemented
- [ ] All tests passing
- [ ] Code reviewed
