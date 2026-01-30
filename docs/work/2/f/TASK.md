# Phase 2, Stream F: Burn Secret Lambda

## Goal
Implement the Lambda function that allows creators to delete secrets early.

## Files
- `backend/functions/burn-secret/index.js`
- `backend/functions/burn-secret/package.json`
- `backend/functions/burn-secret/index.test.js`

## Scope
- Validate burn token from header
- Delete secret from DynamoDB if token matches
- **CRITICAL:** Always return 204, even if secret doesn't exist or token is wrong (no oracle)

## API Contract

```
DELETE /secrets/{id}
Headers:
  X-Burn-Token: <token>

Response: 204 No Content (ALWAYS)
```

## Anti-Oracle Requirements
Return 204 in ALL cases:
- Valid burn token, secret exists → delete, return 204
- Valid burn token, secret already deleted → return 204
- Invalid burn token → return 204
- Missing burn token → return 204
- Invalid secret ID → return 204

This prevents attackers from probing whether secrets exist.

## Implementation
1. Parse secret ID from path
2. Get burn token from `X-Burn-Token` header
3. If token missing or empty → return 204 (do nothing)
4. Attempt conditional delete: `DELETE WHERE id = :id AND burnToken = :token`
5. Regardless of result → return 204

## Dependencies
- Stream 2G (shared utilities) — dynamo.js, responses.js

## Tests Required
- Valid burn token deletes secret
- Returns 204 on success
- Returns 204 when secret doesn't exist
- Returns 204 when burn token is wrong
- Returns 204 when burn token is missing
- Secret is actually deleted from DynamoDB

## Exit Criteria
- [ ] Lambda implemented
- [ ] All tests passing
- [ ] Anti-oracle behavior verified (always 204)
- [ ] Deploys successfully with SAM local
- [ ] Code reviewed
