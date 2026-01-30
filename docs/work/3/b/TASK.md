# Phase 3, Stream B: E2E Test Suite

## Goal
Create comprehensive end-to-end tests for all user flows.

## Files
- `tests/e2e/create-retrieve.test.js`
- `tests/e2e/multiple-views.test.js`
- `tests/e2e/passphrase.test.js`
- `tests/e2e/expiration.test.js`
- `tests/e2e/burn.test.js`
- `tests/e2e/anti-oracle.test.js`
- `tests/e2e/setup.js`
- `tests/e2e/package.json`

## Test Framework
Use Playwright or direct API/crypto testing with Node.js

## Test Suites

### create-retrieve.test.js
```javascript
describe('Basic Create and Retrieve', () => {
  test('create secret and retrieve successfully')
  test('retrieved content matches original')
  test('secret is destroyed after retrieval')
  test('second retrieval returns 404')
})
```

### multiple-views.test.js
```javascript
describe('Multiple Views', () => {
  test('maxViews=2 allows two retrievals')
  test('maxViews=3 allows three retrievals')
  test('retrieval N+1 returns 404')
  test('idempotency window allows re-fetch within 30s')
  test('idempotency fails after 30s')
})
```

### passphrase.test.js
```javascript
describe('Passphrase Protection', () => {
  test('create with passphrase succeeds')
  test('retrieve with correct passphrase succeeds')
  test('retrieve with wrong passphrase fails decryption')
  test('retrieve without passphrase fails decryption')
})
```

### expiration.test.js
```javascript
describe('Expiration', () => {
  test('secret available before expiry')
  test('secret unavailable after expiry')
  test('short TTL (15 min) enforced')
  // Note: May need time mocking or short TTLs for testing
})
```

### burn.test.js
```javascript
describe('Burn Secret', () => {
  test('burn with valid token deletes secret')
  test('retrieve after burn returns 404')
  test('burn always returns 204')
  test('burn with invalid token returns 204')
  test('burn non-existent secret returns 204')
})
```

### anti-oracle.test.js
```javascript
describe('Anti-Oracle Protection', () => {
  test('missing secret returns 404 with standard body')
  test('expired secret returns 404 with standard body')
  test('consumed secret returns 404 with standard body')
  test('all 404 responses are byte-identical')
  test('response timing is similar for all 404 cases')
})
```

## Setup

### setup.js
```javascript
// API helpers
async function createSecret(options)
async function retrieveSecret(id, accessToken)
async function burnSecret(id, burnToken)

// Crypto helpers (Node.js implementation or import from frontend)
async function encryptForTest(plaintext, passphrase)
async function decryptForTest(payload, key, passphrase)

// Test fixtures
const TEST_SECRET = 'This is a test secret'
const TEST_PASSPHRASE = 'correct-horse-battery-staple'
```

## CI Integration
- Tests should be runnable in CI
- Require local SAM + DynamoDB running
- Or use test containers

## Exit Criteria
- [ ] All test files created
- [ ] All tests passing
- [ ] Tests run in CI (or documented how to run locally)
- [ ] Coverage report generated
- [ ] Code reviewed
