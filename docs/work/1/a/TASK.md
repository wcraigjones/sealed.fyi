# Phase 1, Stream A: Define All Contracts

## Goal
Establish all interfaces and contracts so Phase 2 streams can work independently without coordination.

## Deliverables

1. `docs/API.md` — Complete REST API specification
2. `docs/CRYPTO.md` — Crypto library interface and algorithms
3. `docs/SCHEMA.md` — DynamoDB schema
4. `docs/TESTING.md` — Test specifications for all components

## API Contract Requirements

### POST /token
- Response: token (JWT), nonce, powChallenge, expiresAt
- JWT Claims: jti, exp, iat, op, nonce, pow_difficulty, pow_prefix
- JWT Algorithm: HS256

### POST /secrets
- Headers: Authorization Bearer token
- Request: ciphertext, iv, salt, nonce, pow, ttl, maxViews, passphraseProtected
- Response: id, burnToken, expiresAt
- Errors: 400 invalid_request, 401 invalid_token, 403 invalid_pow

### GET /secrets/{id}
- Query: accessToken (optional, for idempotency)
- Response: ciphertext, iv, salt, passphraseProtected, accessToken
- Error: 404 not_available (identical for missing/expired/consumed/malformed)

### DELETE /secrets/{id}
- Headers: X-Burn-Token
- Response: 204 always

## Crypto Contract Requirements

### Types
- EncryptedPayload: { ciphertext, iv }
- EncryptedSecret: { ciphertext, iv, salt? }
- PowChallenge: { difficulty, prefix }

### Functions
- generateKey(): CryptoKey
- encrypt(plaintext, key): EncryptedPayload
- decrypt(ciphertext, iv, key): string
- deriveKeyFromPassphrase(passphrase, salt): CryptoKey
- generateSalt(): string
- keyToBase64Url(key): string
- base64UrlToKey(encoded): CryptoKey
- encryptSecret(plaintext, passphrase?): { payload, urlFragment }
- decryptSecret(payload, urlFragment, passphrase?): string
- solveChallenge(nonce, challenge): string
- verifyChallenge(nonce, solution, challenge): boolean

## DynamoDB Schema Requirements

Table: sealed-secrets
- id (PK), ciphertext, iv, salt, passphraseProtected, remainingViews
- burnToken, createdAt, expiresAt (TTL), lastAccessAt, lastAccessToken

## Exit Criteria

- [x] All four docs written
- [x] Contracts reviewed via mega-review
- [x] Feedback addressed (TTL range clarified, burnToken hex fixed, test vectors added, key wrapping clarified, anti-oracle for malformed IDs, Cache-Control headers)
- [x] Contracts frozen and ready for Phase 2

## Completed

- **Date:** 2026-01-30
- **Summary:** Created all four contract documents (API.md, CRYPTO.md, SCHEMA.md, TESTING.md). Ran mega-review with Codex and Gemini. Addressed all high and medium priority issues including:
  - Clarified TTL as a range (900-7776000) with suggested UI presets
  - Fixed invalid hex characters in burnToken examples
  - Added concrete test vectors for AES-GCM, PBKDF2, base64url, and PoW
  - Clarified key wrapping flow with specific algorithm details (AES-256-GCM)
  - Fixed "Forward Secrecy" terminology to "Key Separation"
  - Added anti-oracle behavior for malformed IDs
  - Added Cache-Control: no-store header requirement
  - Added rate limiting test for 429 response
  - Fixed ID entropy claim (128 bits, not 132)
- **Notes:** Token/nonce replay prevention will use conditional writes with DynamoDB (to be implemented in Phase 2G shared utilities). Detailed token storage not needed since tokens expire in 5 minutes and are single-use by design.