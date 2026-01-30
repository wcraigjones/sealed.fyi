# Phase 2, Stream E: Get Secret Lambda

## Goal
Implement the Lambda function that fetches and consumes secrets.

## Files
- `backend/functions/get-secret/index.js`
- `backend/functions/get-secret/package.json`
- `backend/functions/get-secret/index.test.js`

## Scope
- Fetch secret by ID from DynamoDB
- Check if exists and not expired (application-level check)
- Handle idempotency window (30 sec grace period)
- Decrement `remainingViews`
- Delete if `remainingViews` reaches 0
- Return ciphertext, iv, salt, passphraseProtected, accessToken
- **CRITICAL:** Return identical 404 for missing, expired, consumed

## API Contract

```
GET /secrets/{id}?accessToken=optional

Response (200):
{
  "ciphertext": "base64...",
  "iv": "base64...",
  "salt": "base64..." | null,
  "passphraseProtected": false,
  "accessToken": "random32chars..."
}

Response (404):
{
  "error": "not_available"
}
```

## Idempotency Logic
1. If `accessToken` query param provided:
   - Check if matches `lastAccessToken` in DB
   - Check if within 30 seconds of `lastAccessAt`
   - If both true: return secret without decrementing views
2. Otherwise:
   - Decrement `remainingViews`
   - Generate new `accessToken`
   - Update `lastAccessAt` and `lastAccessToken`
   - If `remainingViews` = 0: delete secret after returning

## Anti-Oracle Requirements
- Missing secret: 404 `{ "error": "not_available" }`
- Expired secret: 404 `{ "error": "not_available" }`
- Consumed secret: 404 `{ "error": "not_available" }`
- All three MUST be identical (same status, same body, similar timing)

## Dependencies
- Stream 2G (shared utilities) — dynamo.js, responses.js

## Tests Required
- Valid ID returns secret
- Returns correct response shape
- Decrements remainingViews
- Deletes when remainingViews = 0
- Idempotency window works (same accessToken within 30s)
- Idempotency fails after 30s
- Missing ID returns 404
- Expired secret returns 404
- Consumed secret returns 404
- All 404 responses are identical

## Exit Criteria
- [ ] Lambda implemented
- [ ] All tests passing
- [ ] Anti-oracle behavior verified
- [ ] Deploys successfully with SAM local
- [ ] Code reviewed
