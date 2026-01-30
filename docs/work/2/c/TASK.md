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
- [ ] Lambda implemented
- [ ] All tests passing
- [ ] Deploys successfully with SAM local
- [ ] Code reviewed
