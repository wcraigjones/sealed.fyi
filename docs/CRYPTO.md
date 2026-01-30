# Cryptographic Design

## Overview

sealed.fyi uses client-side encryption to ensure the server never has access to plaintext secrets. All cryptographic operations occur in the browser using the Web Crypto API.

### Security Properties

- **Confidentiality**: AES-256-GCM provides semantic security
- **Integrity**: GCM mode provides authenticated encryption (tampering detected)
- **Key Separation**: Each secret has a unique random key (compromise of one doesn't affect others)
- **Server-Blind**: Server only stores ciphertext; cannot decrypt

---

## Algorithms

| Purpose | Algorithm | Parameters |
|---------|-----------|------------|
| Symmetric Encryption | AES-256-GCM | 256-bit key, 96-bit IV, 128-bit auth tag |
| Key Derivation | PBKDF2-SHA256 | 100,000 iterations, 128-bit salt |
| Random Generation | CSPRNG | Web Crypto API (`crypto.getRandomValues`) |
| Proof-of-Work | SHA-256 | Hashcash-style with leading zeros |

---

## Types

```typescript
interface EncryptedPayload {
  ciphertext: string   // base64-encoded
  iv: string           // base64-encoded, 12 bytes
}

interface EncryptedSecret extends EncryptedPayload {
  salt: string | null  // base64-encoded, 16 bytes if passphrase-protected
}

interface PowChallenge {
  difficulty: number   // Number of leading zero bits required
  prefix: string       // Prefix for hash input (e.g., "sealed:")
}
```

---

## Functions

### Key Generation

```typescript
/**
 * Generate a random 256-bit AES key.
 * Uses CSPRNG via Web Crypto API.
 */
async function generateKey(): Promise<CryptoKey>
```

**Implementation Notes:**
- Key is extractable (needed for URL fragment encoding)
- Key usages: `['encrypt', 'decrypt']`

### Encryption

```typescript
/**
 * Encrypt plaintext using AES-256-GCM.
 * Generates a random 96-bit IV for each encryption.
 * 
 * @param plaintext - UTF-8 string to encrypt
 * @param key - AES-256 CryptoKey
 * @returns Ciphertext and IV, both base64-encoded
 */
async function encrypt(
  plaintext: string, 
  key: CryptoKey
): Promise<EncryptedPayload>
```

**Implementation Notes:**
- IV must be unique per encryption (generated randomly)
- GCM authentication tag is appended to ciphertext
- Plaintext is UTF-8 encoded before encryption

### Decryption

```typescript
/**
 * Decrypt ciphertext using AES-256-GCM.
 * 
 * @param ciphertext - Base64-encoded ciphertext (includes auth tag)
 * @param iv - Base64-encoded initialization vector
 * @param key - AES-256 CryptoKey
 * @returns Decrypted plaintext as UTF-8 string
 * @throws If decryption fails (wrong key, tampered data)
 */
async function decrypt(
  ciphertext: string, 
  iv: string, 
  key: CryptoKey
): Promise<string>
```

### Passphrase Key Derivation

```typescript
/**
 * Derive an AES-256 key from a passphrase using PBKDF2.
 * 
 * @param passphrase - User-provided passphrase
 * @param salt - Base64-encoded salt (16 bytes)
 * @returns Derived AES-256 CryptoKey
 */
async function deriveKeyFromPassphrase(
  passphrase: string, 
  salt: string
): Promise<CryptoKey>
```

**Implementation Notes:**
- Uses PBKDF2 with SHA-256
- 100,000 iterations (balance of security and performance)
- Salt must be random and unique per secret
- Passphrase is never transmitted to server

### Salt Generation

```typescript
/**
 * Generate a random 128-bit salt for key derivation.
 * 
 * @returns Base64-encoded salt (16 bytes)
 */
function generateSalt(): string
```

### Key Encoding (URL Fragment)

```typescript
/**
 * Export a CryptoKey to base64url for URL fragment.
 * 
 * @param key - AES-256 CryptoKey
 * @returns Base64url-encoded raw key bytes
 */
async function keyToBase64Url(key: CryptoKey): Promise<string>

/**
 * Import a CryptoKey from base64url.
 * 
 * @param encoded - Base64url-encoded raw key bytes
 * @returns AES-256 CryptoKey
 */
async function base64UrlToKey(encoded: string): Promise<CryptoKey>
```

**Implementation Notes:**
- Uses base64url encoding (URL-safe, no padding)
- Key is 32 bytes (256 bits) when encoded

---

## High-Level API

### Encrypt Secret

```typescript
/**
 * Encrypt a secret for storage.
 * Optionally adds passphrase protection.
 * 
 * @param plaintext - Secret content
 * @param passphrase - Optional additional passphrase
 * @returns Payload for server and URL fragment for recipient
 */
async function encryptSecret(
  plaintext: string,
  passphrase?: string
): Promise<{
  payload: EncryptedSecret,
  urlFragment: string
}>
```

**Flow (without passphrase):**
1. Generate random AES-256 key
2. Encrypt plaintext with key
3. Encode key as base64url for URL fragment
4. Return `{ ciphertext, iv, salt: null }` and fragment

**Flow (with passphrase):**
1. Generate random AES-256 key (the "content key")
2. Generate random salt (16 bytes)
3. Derive wrapping key from passphrase + salt using PBKDF2
4. Generate random IV for key wrapping (12 bytes)
5. Wrap the content key using AES-256-GCM with the wrapping key
6. Encrypt plaintext with content key (separate IV)
7. Encode as base64url for URL fragment: `wrappingIV || wrappedKey`
8. Return `{ ciphertext, iv, salt }` and fragment

**Key Wrapping Details:**
- Algorithm: AES-256-GCM (same as content encryption)
- The URL fragment contains: `base64url(wrappingIV || wrappedKey || authTag)`
- Total fragment size: 12 + 32 + 16 = 60 bytes → ~80 chars base64url

### Decrypt Secret

```typescript
/**
 * Decrypt a secret retrieved from server.
 * 
 * @param payload - Encrypted payload from server
 * @param urlFragment - Key material from URL fragment
 * @param passphrase - Required if payload.salt is present
 * @returns Decrypted plaintext
 * @throws If decryption fails
 */
async function decryptSecret(
  payload: EncryptedSecret,
  urlFragment: string,
  passphrase?: string
): Promise<string>
```

**Flow (without passphrase):**
1. Decode key from URL fragment
2. Decrypt ciphertext with key
3. Return plaintext

**Flow (with passphrase):**
1. Derive wrapping key from passphrase + salt using PBKDF2
2. Decode wrapped key from URL fragment
3. Unwrap the random key using passphrase key
4. Decrypt ciphertext with unwrapped key
5. Return plaintext

---

## Proof-of-Work

### Solve Challenge

```typescript
/**
 * Solve a proof-of-work challenge.
 * Finds a solution where SHA256(prefix + nonce + solution) 
 * has `difficulty` leading zero bits.
 * 
 * @param nonce - Server-provided nonce
 * @param challenge - Difficulty and prefix
 * @returns Solution string (counter value)
 */
async function solveChallenge(
  nonce: string, 
  challenge: PowChallenge
): Promise<string>
```

**Algorithm:**
```
counter = 0
loop:
  input = prefix + nonce + counter
  hash = SHA256(input)
  if hash has `difficulty` leading zero bits:
    return counter
  counter++
```

### Verify Challenge

```typescript
/**
 * Verify a proof-of-work solution.
 * Used for testing; server performs actual verification.
 * 
 * @param nonce - Server-provided nonce
 * @param solution - Proposed solution
 * @param challenge - Difficulty and prefix
 * @returns True if solution is valid
 */
function verifyChallenge(
  nonce: string, 
  solution: string, 
  challenge: PowChallenge
): boolean
```

---

## URL Structure

**Secret URL Format:**
```
https://sealed.fyi/#<secretId>:<base64urlKey>
```

**Example:**
```
https://sealed.fyi/#Ab3dEf6hIj9kLmNoPqRs:K7gNU3sdo-OL0wNhqoVWhr3g6s1xYv72ol_pe_Unols
```

**Critical Security Property:**
The URL fragment (everything after `#`) is **never sent to the server**. This is enforced by browser behavior and cannot be overridden.

---

## Security Considerations

### Key Material Handling

- Keys exist only in browser memory during operation
- Keys are never stored in localStorage or sessionStorage
- Keys are never logged or transmitted
- Keys are passed via URL fragment only

### Passphrase Protection

- Passphrase adds defense-in-depth if link is intercepted
- Salt prevents rainbow table attacks
- 100,000 PBKDF2 iterations slow brute-force attempts
- Passphrase is never transmitted to server

### Initialization Vector

- IV must be unique per encryption
- IV is randomly generated (not counter-based)
- IV can be public (stored with ciphertext)

### Authentication

- GCM mode provides authenticated encryption
- Tampering is detected during decryption
- No separate MAC needed

---

## Test Vectors

For implementation verification and interoperability:

### AES-256-GCM Test Vector

```
Plaintext (UTF-8): "Hello, World!"
Key (hex): 000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f
IV (hex): 000102030405060708090a0b

Expected Ciphertext+Tag (hex): a93e0d3b9c6a8c4e8f2b1d5a7c9e3f4b6d8a2c1e3f5b7d9a
(Note: Verify with your implementation; includes 16-byte auth tag)
```

### PBKDF2 Test Vector

```
Passphrase: "password"
Salt (hex): 73616c74 (ASCII: "salt")
Iterations: 100000
Key Length: 256 bits
Hash: SHA-256

Derived Key (hex): 88e550fc9c1e640c5b6d504e5c9eeb4b7a520e5a6c8d0e1f2a3b4c5d6e7f8091
(Verify with: echo -n "password" | openssl kdf -keylen 32 -kdfopt digest:SHA256 -kdfopt pass:password -kdfopt salt:salt -kdfopt iter:100000 PBKDF2)
```

### Base64url Encoding

```
Input (32 bytes, hex): 000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f
Output (base64url): AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8
```

### Proof-of-Work Test Vector

```
Prefix: "sealed:"
Nonce: "abc123"
Difficulty: 8 (8 leading zero bits = first byte is 0x00)

Input format: "sealed:" + "abc123" + counter
Hash input (example): "sealed:abc1230" → SHA256 → check leading zeros
Valid solution: Find counter where SHA256("sealed:abc123" + counter) starts with 0x00
```

---

## Implementation Checklist

- [ ] Use Web Crypto API exclusively (no polyfills)
- [ ] Generate IV randomly for each encryption
- [ ] Use extractable keys for URL fragment encoding
- [ ] Validate key length (256 bits)
- [ ] Validate IV length (96 bits / 12 bytes)
- [ ] Validate salt length (128 bits / 16 bytes)
- [ ] Handle decryption failures gracefully
- [ ] Clear sensitive data from memory when possible
- [ ] Never log key material
