# Phase 2, Stream D: Create Secret Lambda

## Goal
Implement the Lambda function that validates tokens/PoW and stores encrypted secrets.

## Files
- `backend/functions/create-secret/index.js`
- `backend/functions/create-secret/package.json`
- `backend/functions/create-secret/index.test.js`

## Scope
- Validate JWT token (not expired, nonce matches)
- Verify PoW solution
- Validate request body (size limits, TTL bounds, maxViews bounds)
- Generate high-entropy secret ID (22 chars base64url)
- Generate burn token (32 chars hex)
- Store in DynamoDB
- Return secret ID, burn token, expiration

## API Contract

```
POST /secrets
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json

Request:
{
  "ciphertext": "base64...",
  "iv": "base64...",
  "salt": "base64..." | null,
  "nonce": "abc123...",
  "pow": "solution...",
  "ttl": 86400,
  "maxViews": 1,
  "passphraseProtected": false
}

Response (201):
{
  "id": "abc123XYZ...",
  "burnToken": "hex32chars...",
  "expiresAt": 1234567890
}

Response (400): { "error": "invalid_request", "message": "..." }
Response (401): { "error": "invalid_token" }
Response (403): { "error": "invalid_pow" }
```

## Validation Rules
- TTL: 900 (15 min) to 7776000 (90 days) seconds
- maxViews: 1 to 5
- ciphertext: max 68 KB (base64)
- iv: exactly 12 bytes (16 chars base64)
- salt: exactly 16 bytes or null
- nonce: must match token nonce

## Dependencies
- Stream 2G (shared utilities) — token.js, pow.js, dynamo.js, responses.js

## Tests Required
- Valid request creates secret
- Returns correct response shape
- Invalid token returns 401
- Expired token returns 401
- Invalid PoW returns 403
- Invalid TTL returns 400
- Invalid maxViews returns 400
- Oversized ciphertext returns 400
- Secret stored correctly in DynamoDB

## Exit Criteria
- [ ] Lambda implemented
- [ ] All tests passing
- [ ] Deploys successfully with SAM local
- [ ] Code reviewed
