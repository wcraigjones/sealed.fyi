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
- [ ] Code reviewed

## Implementation Summary

### Files Created
- `backend/functions/shared/package.json` - Package configuration with dependencies
- `backend/functions/shared/dynamo.js` - DynamoDB client helpers (6 functions)
- `backend/functions/shared/token.js` - JWT and token generation utilities (6 functions)
- `backend/functions/shared/pow.js` - Server-side PoW verification (2 functions)
- `backend/functions/shared/responses.js` - Uniform HTTP response builders (7 functions)
- `backend/functions/shared/validation.js` - Input validation helpers (8 functions)
- `backend/functions/shared/index.js` - Re-exports all modules

### Test Files Created
- `backend/functions/shared/dynamo.test.js` - 10 tests
- `backend/functions/shared/token.test.js` - 15 tests
- `backend/functions/shared/pow.test.js` - 15 tests
- `backend/functions/shared/responses.test.js` - 19 tests
- `backend/functions/shared/validation.test.js` - 70 tests

### Test Results
- **129 tests passing**
- **0 tests failing**
- **96.2% code coverage**

### Key Implementation Notes
1. DynamoDB client uses singleton pattern with `resetClient()` for testing
2. Environment variables (`JWT_SECRET`, `DYNAMODB_TABLE`, `DYNAMODB_ENDPOINT`) are read at call time for testability
3. All 404 responses from `notAvailable()` are identical (anti-oracle protection)
4. Added `validateSecretId()` and `validateBurnToken()` validators beyond the spec for completeness
