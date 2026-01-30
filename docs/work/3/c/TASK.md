# Phase 3, Stream C: Security Test Suite

## Goal
Create security-focused tests to verify privacy and security guarantees.

## Files
- `tests/security/key-leakage.test.js`
- `tests/security/anti-oracle.test.js`
- `tests/security/token-security.test.js`
- `tests/security/input-validation.test.js`
- `tests/security/CHECKLIST.md`

## Test Suites

### key-leakage.test.js
```javascript
describe('Key Material Leakage Prevention', () => {
  test('URL fragment not present in API requests')
  test('decryption key not in localStorage')
  test('decryption key not in sessionStorage')
  test('decryption key not logged to console')
  test('Referrer header does not contain fragment')
})
```

### anti-oracle.test.js
```javascript
describe('Anti-Oracle Protection', () => {
  test('missing/expired/consumed responses are byte-identical')
  test('response Content-Length is identical for all 404s')
  test('response timing variance < 50ms for all 404s')
  test('no state-revealing error messages')
  test('burn endpoint always returns 204')
})
```

### token-security.test.js
```javascript
describe('Token Security', () => {
  test('expired token is rejected')
  test('token cannot be reused (nonce replay)')
  test('invalid JWT signature is rejected')
  test('modified JWT payload is rejected')
  test('token from different server is rejected')
})
```

### input-validation.test.js
```javascript
describe('Input Validation', () => {
  test('oversized ciphertext (>68KB) rejected')
  test('invalid TTL (<900s) rejected')
  test('invalid TTL (>7776000s) rejected')
  test('invalid maxViews (<1) rejected')
  test('invalid maxViews (>5) rejected')
  test('malformed base64 rejected')
  test('SQL injection in ID rejected')
  test('XSS in error messages sanitized')
})
```

## Security Checklist (CHECKLIST.md)

```markdown
# Security Audit Checklist

## Cryptographic Security
- [ ] AES-256-GCM used for encryption
- [ ] Random IV generated for each encryption
- [ ] PBKDF2 with 100,000 iterations for passphrase
- [ ] Keys are 256 bits from CSPRNG
- [ ] Keys never transmitted to server

## Network Security
- [ ] URL fragment never in requests
- [ ] No sensitive data in query strings
- [ ] HTTPS enforced
- [ ] Strict CSP headers
- [ ] no-referrer policy

## Anti-Oracle
- [ ] All 404 responses identical
- [ ] Timing consistent across responses
- [ ] No state-revealing messages
- [ ] Burn always returns 204

## Token Security
- [ ] Short TTL (5 min)
- [ ] Single-use nonce
- [ ] Secure JWT signing
- [ ] No sensitive data in claims

## Input Validation
- [ ] Size limits enforced
- [ ] Type validation
- [ ] Range validation
- [ ] No injection vulnerabilities

## Data Minimization
- [ ] No IP logging
- [ ] No user agent logging
- [ ] No referrer logging
- [ ] Short log retention
```

## Testing Tools
- Custom timing measurement for oracle tests
- Request/response inspection
- localStorage/sessionStorage monitoring
- Console log interception

## Exit Criteria
- [ ] All security tests passing
- [ ] Checklist completed and documented
- [ ] No security issues found (or all documented)
- [ ] Code reviewed by security-focused reviewer
