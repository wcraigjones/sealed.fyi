# Testing Specifications

## Overview

This document defines the test requirements for all sealed.fyi components. Tests are organized by component and phase.

---

## Testing Philosophy

- **Security-critical paths** require exhaustive testing
- **Anti-oracle behavior** must be verified (identical responses)
- **Crypto operations** require round-trip and failure tests
- **All tests** must be deterministic and reproducible

---

## Phase 2: Unit Tests

### 2A: Crypto Library Tests

**File:** `frontend/js/crypto.test.js`

#### Key Generation
```javascript
describe('generateKey', () => {
  test('generates a 256-bit AES key')
  test('key is extractable')
  test('key has correct usages (encrypt, decrypt)')
  test('generates unique keys on each call')
})
```

#### Encryption/Decryption
```javascript
describe('encrypt/decrypt', () => {
  test('round-trip preserves plaintext')
  test('encrypts empty string')
  test('encrypts unicode characters')
  test('encrypts large payload (50KB)')
  test('generates unique IV for each encryption')
  test('same plaintext produces different ciphertext (due to IV)')
})

describe('decrypt failures', () => {
  test('wrong key throws error')
  test('tampered ciphertext throws error')
  test('tampered IV throws error')
  test('truncated ciphertext throws error')
  test('invalid base64 throws error')
})
```

#### Passphrase Key Derivation
```javascript
describe('deriveKeyFromPassphrase', () => {
  test('same passphrase + salt produces same key')
  test('different passphrase produces different key')
  test('different salt produces different key')
  test('empty passphrase works')
  test('unicode passphrase works')
  test('long passphrase works (1000 chars)')
})
```

#### Base64url Encoding
```javascript
describe('keyToBase64Url / base64UrlToKey', () => {
  test('round-trip preserves key')
  test('output is URL-safe (no +, /, =)')
  test('output is correct length (43 chars for 32 bytes)')
})
```

#### High-Level API
```javascript
describe('encryptSecret', () => {
  test('returns payload and urlFragment')
  test('payload contains ciphertext and iv')
  test('urlFragment is valid base64url')
  test('with passphrase: payload contains salt')
  test('without passphrase: salt is null')
})

describe('decryptSecret', () => {
  test('decrypts secret encrypted without passphrase')
  test('decrypts secret encrypted with passphrase')
  test('wrong passphrase throws error')
  test('missing passphrase for protected secret throws error')
})
```

---

### 2B: Proof-of-Work Tests

**File:** `frontend/js/pow.test.js`

```javascript
describe('solveChallenge', () => {
  test('finds valid solution for difficulty 8')
  test('finds valid solution for difficulty 16')
  test('finds valid solution for difficulty 18')
  test('solution verifies correctly')
  test('completes within reasonable time (< 10s for difficulty 18)')
})

describe('verifyChallenge', () => {
  test('accepts valid solution')
  test('rejects invalid solution')
  test('rejects empty solution')
  test('rejects solution for different nonce')
  test('rejects solution for different prefix')
  test('rejects solution for higher difficulty')
})
```

---

### 2C: Create Token Lambda Tests

**File:** `backend/functions/create-token/index.test.js`

```javascript
describe('POST /token', () => {
  test('returns 200 with valid response shape')
  test('token is valid JWT')
  test('JWT contains required claims (jti, exp, iat, op, nonce)')
  test('JWT expires in 5 minutes')
  test('nonce is 32 hex characters')
  test('powChallenge contains difficulty and prefix')
  test('expiresAt matches JWT exp claim')
  test('each request generates unique nonce')
  test('each request generates unique jti')
  test('returns 429 when rate limit exceeded (10/min)')
})
```

---

### 2D: Create Secret Lambda Tests

**File:** `backend/functions/create-secret/index.test.js`

```javascript
describe('POST /secrets', () => {
  // Success cases
  test('creates secret with valid request')
  test('returns id, burnToken, expiresAt')
  test('id is 22 characters base64url')
  test('burnToken is 32 characters hex')
  test('secret is stored in DynamoDB')
  
  // Token validation
  test('rejects missing Authorization header (401)')
  test('rejects invalid JWT (401)')
  test('rejects expired JWT (401)')
  test('rejects mismatched nonce (401)')
  
  // PoW validation
  test('rejects invalid PoW solution (403)')
  test('rejects PoW for different nonce (403)')
  
  // Input validation
  test('rejects missing ciphertext (400)')
  test('rejects oversized ciphertext >68KB (400)')
  test('rejects invalid base64 ciphertext (400)')
  test('rejects missing iv (400)')
  test('rejects wrong-length iv (400)')
  test('rejects invalid salt length (400)')
  test('rejects ttl < 900 (400)')
  test('rejects ttl > 7776000 (400)')
  test('rejects maxViews < 1 (400)')
  test('rejects maxViews > 5 (400)')
})
```

---

### 2E: Get Secret Lambda Tests

**File:** `backend/functions/get-secret/index.test.js`

```javascript
describe('GET /secrets/{id}', () => {
  // Success cases
  test('returns secret for valid id')
  test('returns ciphertext, iv, salt, passphraseProtected, accessToken')
  test('decrements remainingViews')
  test('deletes secret when remainingViews reaches 0')
  
  // Idempotency
  test('same accessToken within 30s returns secret without decrement')
  test('same accessToken after 30s decrements normally')
  test('different accessToken decrements normally')
  
  // Anti-oracle (CRITICAL)
  test('missing secret returns 404 not_available')
  test('expired secret returns 404 not_available')
  test('consumed secret returns 404 not_available')
  test('malformed ID returns 404 not_available')
  test('all 404 responses have identical body')
  test('all 404 responses have identical headers')
  test('all 404 responses have Cache-Control: no-store')
})
```

---

### 2F: Burn Secret Lambda Tests

**File:** `backend/functions/burn-secret/index.test.js`

```javascript
describe('DELETE /secrets/{id}', () => {
  // All cases return 204
  test('valid burnToken deletes secret and returns 204')
  test('invalid burnToken returns 204')
  test('missing burnToken returns 204')
  test('non-existent secret returns 204')
  test('already deleted secret returns 204')
  
  // Verify deletion
  test('secret is actually deleted from DynamoDB')
  test('subsequent GET returns 404')
})
```

---

### 2G: Shared Utilities Tests

**Files:** `backend/functions/shared/*.test.js`

#### dynamo.js
```javascript
describe('DynamoDB helpers', () => {
  test('getSecret returns secret for valid id')
  test('getSecret returns null for missing id')
  test('putSecret stores secret')
  test('putSecret fails on duplicate id')
  test('deleteSecret removes secret')
  test('deleteSecret succeeds for missing id')
  test('decrementViews decrements and returns new value')
  test('decrementViews deletes when reaching 0')
  test('conditionalDelete deletes with matching token')
  test('conditionalDelete fails with wrong token')
})
```

#### token.js
```javascript
describe('Token helpers', () => {
  test('generateToken creates valid JWT')
  test('validateToken accepts valid token')
  test('validateToken rejects expired token')
  test('validateToken rejects tampered token')
  test('generateNonce returns 32 hex chars')
  test('generateSecretId returns 22 base64url chars')
  test('generateBurnToken returns 32 hex chars')
  test('generateAccessToken returns 32 hex chars')
})
```

#### pow.js
```javascript
describe('PoW verification', () => {
  test('verifyPow accepts valid solution')
  test('verifyPow rejects invalid solution')
  test('generateChallenge returns difficulty and prefix')
})
```

#### validation.js
```javascript
describe('Input validation', () => {
  test('validateTTL accepts valid range')
  test('validateTTL rejects out of range')
  test('validateMaxViews accepts 1-5')
  test('validateMaxViews rejects out of range')
  test('validateCiphertext accepts valid base64 under limit')
  test('validateCiphertext rejects oversized')
  test('validateIV accepts 12 bytes')
  test('validateIV rejects wrong length')
  test('validateSalt accepts 16 bytes or null')
  test('validateSalt rejects wrong length')
})
```

---

## Phase 3: Integration Tests

### 3A: Frontend Integration

**Manual/automated testing of:**
- Create flow works end-to-end
- Reveal flow works end-to-end
- Passphrase flow works
- Error states display correctly
- Loading states display correctly

---

### 3B: E2E Test Suite

**Directory:** `tests/e2e/`

#### create-retrieve.test.js
```javascript
describe('Basic Create and Retrieve', () => {
  test('create secret → retrieve → content matches')
  test('secret is destroyed after retrieval')
  test('second retrieval returns 404')
})
```

#### multiple-views.test.js
```javascript
describe('Multiple Views', () => {
  test('maxViews=2 allows two retrievals')
  test('maxViews=3 allows three retrievals')
  test('retrieval N+1 returns 404')
  test('idempotency window allows re-fetch within 30s')
  test('idempotency fails after 30s')
})
```

#### passphrase.test.js
```javascript
describe('Passphrase Protection', () => {
  test('create with passphrase succeeds')
  test('retrieve with correct passphrase succeeds')
  test('retrieve with wrong passphrase fails decryption')
  test('retrieve without passphrase fails decryption')
})
```

#### expiration.test.js
```javascript
describe('Expiration', () => {
  test('secret available before expiry')
  test('secret unavailable after expiry')
  test('short TTL enforced')
})
```

#### burn.test.js
```javascript
describe('Burn Secret', () => {
  test('burn with valid token deletes secret')
  test('retrieve after burn returns 404')
  test('burn always returns 204')
})
```

#### anti-oracle.test.js
```javascript
describe('Anti-Oracle Protection', () => {
  test('missing secret returns 404 with standard body')
  test('expired secret returns 404 with standard body')
  test('consumed secret returns 404 with standard body')
  test('all 404 responses are byte-identical')
})
```

---

### 3C: Security Test Suite

**Directory:** `tests/security/`

#### key-leakage.test.js
```javascript
describe('Key Material Leakage Prevention', () => {
  test('URL fragment not present in API requests')
  test('decryption key not in localStorage')
  test('decryption key not in sessionStorage')
  test('Referrer header does not contain fragment')
})
```

#### anti-oracle.test.js
```javascript
describe('Anti-Oracle Timing', () => {
  test('response timing variance < 50ms for all 404 cases')
  test('response Content-Length identical for all 404s')
})
```

#### token-security.test.js
```javascript
describe('Token Security', () => {
  test('expired token is rejected')
  test('token cannot be reused (nonce replay)')
  test('invalid JWT signature is rejected')
  test('modified JWT payload is rejected')
})
```

#### input-validation.test.js
```javascript
describe('Input Validation Security', () => {
  test('SQL injection in ID rejected/safe')
  test('XSS in error messages sanitized')
  test('oversized payloads rejected')
})
```

---

## Test Infrastructure

### Running Unit Tests

```bash
# Frontend (browser environment)
cd frontend
npx vitest run

# Backend (Node.js)
cd backend/functions/create-token
npm test
```

### Running E2E Tests

```bash
# Requires local stack running
./scripts/local-setup.sh

# Run E2E tests
cd tests/e2e
npm test
```

### CI Configuration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      
  e2e-tests:
    runs-on: ubuntu-latest
    services:
      dynamodb:
        image: amazon/dynamodb-local
        ports:
          - 8000:8000
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: aws-actions/setup-sam@v2
      - run: ./scripts/local-setup.sh
      - run: npm run test:e2e
```

---

## Coverage Requirements

| Component | Minimum Coverage |
|-----------|------------------|
| crypto.js | 100% |
| pow.js | 100% |
| Lambda functions | 90% |
| Shared utilities | 90% |
| E2E flows | All documented flows |

---

## Security Test Checklist

- [ ] Key material never appears in server logs
- [ ] URL fragment not sent to server
- [ ] Responses for missing/expired/consumed are byte-identical
- [ ] No timing side-channels in secret lookup
- [ ] CSP blocks inline scripts
- [ ] PoW prevents bulk creation
- [ ] Token replay is prevented
- [ ] Input validation prevents injection
