# Phase 2, Stream C: Create Token Lambda

## Goal
Implement the Lambda function that issues short-lived authorization tokens.

## Files
- `backend/functions/create-token/index.js`
- `backend/functions/create-token/package.json`
- `backend/functions/create-token/index.test.js`

## Scope
- Generate JWT with 5-minute TTL
- Include random nonce (16 bytes hex)
- Include PoW challenge parameters
- No authentication required

## API Contract

```
POST /token

Response (200):
{
  "token": "jwt...",
  "nonce": "abc123def456...",
  "powChallenge": {
    "difficulty": 18,
    "prefix": "sealed:"
  },
  "expiresAt": 1234567890
}
```

## JWT Claims
- jti: Unique token ID (UUID, prevents replay)
- exp: Expiration timestamp (5 min from issue)
- iat: Issued-at timestamp
- op: "create"
- nonce: Must match response nonce
- pow_difficulty: PoW difficulty level
- pow_prefix: PoW prefix string

## Implementation Details
- Use HS256 algorithm with server-side secret (from environment variable)
- Generate cryptographically random nonce
- Difficulty can be static initially (18), adaptive later

## Dependencies
- Stream 2G (shared utilities) — can mock token.js initially

## Tests Required
- Returns valid JWT
- JWT contains all required claims
- Nonce is random and correct length
- Token expires after 5 minutes
- Response shape matches contract

## Exit Criteria
- [x] Lambda implemented
- [x] All tests passing
- [x] Deploys successfully with SAM local
- [ ] Code reviewed

## Implementation Notes

### Files Created
- `backend/functions/create-token/index.js` - Lambda handler with token generation
- `backend/functions/create-token/package.json` - Dependencies (jsonwebtoken)
- `backend/functions/create-token/index.test.js` - Unit tests (23 tests)

### Key Implementation Details
- Uses Node.js crypto module for secure random nonce generation (16 bytes hex)
- Uses crypto.randomUUID() for JWT jti claim
- JWT signed with HS256 algorithm using JWT_SECRET environment variable
- Returns proper Cache-Control: no-store header
- Exports internal functions for testing via `_internal` object

### Test Coverage
- `generateNonce`: 3 tests (hex string, correct length, uniqueness)
- `generateJti`: 2 tests (UUID format, uniqueness)
- `createToken`: 4 tests (JWT creation, claims, expiration, error handling)
- `handler`: 13 tests (HTTP response, headers, payload validation)
- Response contract: 1 test (API shape validation)

### Dependencies
- jsonwebtoken@^9.0.2 (for JWT signing)
- Node.js 20+ built-in crypto module (for CSPRNG)

## Completed
- **Date:** 2026-01-30
- **Summary:** Implemented Create Token Lambda with full test coverage. All 23 unit tests passing. Lambda is ready for SAM deployment and integration.
