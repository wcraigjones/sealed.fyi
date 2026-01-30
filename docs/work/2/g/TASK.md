# Phase 2, Stream G: Shared Backend Utilities

## Goal
Implement shared utilities used by all Lambda functions.

## Files
- `backend/functions/shared/dynamo.js`
- `backend/functions/shared/token.js`
- `backend/functions/shared/pow.js`
- `backend/functions/shared/responses.js`
- `backend/functions/shared/validation.js`
- `backend/functions/shared/index.js`
- `backend/functions/shared/package.json`
- Unit tests for each module

## Modules

### dynamo.js
DynamoDB client helpers:
```javascript
async function getSecret(id): Promise<Secret | null>
async function putSecret(secret: Secret): Promise<void>
async function deleteSecret(id): Promise<void>
async function decrementViews(id): Promise<{ remaining: number, deleted: boolean }>
async function conditionalDelete(id, burnToken): Promise<boolean>
async function updateAccessToken(id, accessToken, accessTime): Promise<void>
```

### token.js
JWT generation and validation:
```javascript
function generateToken(nonce: string, powChallenge: Challenge): string
function validateToken(token: string): TokenPayload | null
function generateNonce(): string  // 16 bytes hex
function generateSecretId(): string  // 22 chars base64url
function generateBurnToken(): string  // 32 chars hex
function generateAccessToken(): string  // 32 chars hex
```

### pow.js
Server-side PoW verification:
```javascript
function generateChallenge(): Challenge
function verifyPow(nonce: string, solution: string, challenge: Challenge): boolean
```

### responses.js
Uniform response builders:
```javascript
function success(body: object, statusCode = 200): APIGatewayResponse
function created(body: object): APIGatewayResponse
function notAvailable(): APIGatewayResponse  // 404, uniform
function noContent(): APIGatewayResponse  // 204
function badRequest(message: string): APIGatewayResponse
function unauthorized(): APIGatewayResponse
function forbidden(): APIGatewayResponse
```

### validation.js
Input validation helpers:
```javascript
function validateTTL(ttl: number): boolean  // 900 to 7776000
function validateMaxViews(maxViews: number): boolean  // 1 to 5
function validateCiphertext(ciphertext: string): boolean  // max 68KB base64
function validateIV(iv: string): boolean  // 12 bytes base64
function validateSalt(salt: string | null): boolean  // 16 bytes base64 or null
function validateNonce(nonce: string): boolean  // 16 bytes hex
```

## Environment Variables
- `JWT_SECRET` — Secret for signing JWTs
- `DYNAMODB_TABLE` — Table name
- `DYNAMODB_ENDPOINT` — Optional, for local development

## Tests Required
- Each module has unit tests
- dynamo.js: CRUD operations work
- token.js: JWT generation/validation works
- pow.js: PoW verification works
- responses.js: Response shapes are correct
- validation.js: All validators work correctly

## Exit Criteria
- [x] All modules implemented
- [x] All tests passing
- [x] Works with local DynamoDB
- [x] Code reviewed

## Implementation Summary

### Files Created
- `backend/functions/shared/package.json` - Package configuration with Jest testing
- `backend/functions/shared/dynamo.js` - DynamoDB client helpers
- `backend/functions/shared/token.js` - JWT generation and validation
- `backend/functions/shared/pow.js` - Server-side PoW verification
- `backend/functions/shared/responses.js` - Uniform response builders
- `backend/functions/shared/validation.js` - Input validation helpers
- `backend/functions/shared/index.js` - Module re-exports

### Test Files Created
- `backend/functions/shared/dynamo.test.js`
- `backend/functions/shared/token.test.js`
- `backend/functions/shared/pow.test.js`
- `backend/functions/shared/responses.test.js`
- `backend/functions/shared/validation.test.js`

### Test Results
- **149 tests passing**
- **97.91% statement coverage**
- **97.22% branch coverage**
- **100% function coverage**

### Key Features
- DynamoDB client with local endpoint support (`DYNAMODB_ENDPOINT` env var)
- JWT token generation/validation with HS256 algorithm
- PoW verification using SHA-256 hashcash-style
- Uniform API Gateway response builders (anti-oracle 404s)
- Comprehensive input validation with constants exported
- Idempotency window support (30 seconds)
- All functions properly documented with JSDoc

## Review Scores

| Agent | Score | Status |
|-------|-------|--------|
| opus-review | 9/10 | APPROVED |
| gemini-review | 10/10 | APPROVED |
| codex-review | 8/10 | APPROVED |
| glm-review | 9/10 | APPROVED |
| kimi-review | 8/10 | APPROVED |

## Completed
- **Date:** 2026-01-30
- **Summary:** Implemented all shared backend utilities per task specification. All 149 unit tests passing with ~98% coverage. All 5 review agents approved.
- **Notes:** Fixed API contract mismatch in `decrementViews` - accessToken parameter is now optional as specified.
