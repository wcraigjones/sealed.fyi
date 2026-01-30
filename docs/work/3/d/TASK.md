# Phase 3, Stream D: API Documentation

## Goal
Create comprehensive API documentation.

## Files
- `docs/API.md`

## Content

### Overview
- Base URL
- Authentication (token-based for create)
- Rate limiting
- Error handling

### Endpoints

#### POST /token
- Description
- Request (none)
- Response schema with examples
- JWT claims documentation
- Error responses

#### POST /secrets
- Description
- Authentication header
- Request schema with examples
- Field validation rules
- Response schema with examples
- All error responses (400, 401, 403)

#### GET /secrets/{id}
- Description
- Path parameters
- Query parameters (accessToken)
- Response schema with examples
- Idempotency behavior
- 404 response (uniform)

#### DELETE /secrets/{id}
- Description
- Headers (X-Burn-Token)
- Response (always 204)
- Anti-oracle behavior

### Authentication Flow
1. Request token
2. Complete PoW
3. Submit with token

### Error Codes
| Code | Meaning |
|------|---------|
| 400 | Invalid request |
| 401 | Invalid/expired token |
| 403 | Invalid PoW |
| 404 | Not available |

### Rate Limiting
- Token requests: X per minute
- Secret creation: Requires PoW
- Secret retrieval: Y per minute per IP

### CORS
- Allowed origins
- Allowed methods
- Allowed headers

### Examples
- cURL examples for each endpoint
- JavaScript fetch examples

## Exit Criteria
- [ ] All endpoints documented
- [ ] Request/response examples included
- [ ] Error codes documented
- [ ] Authentication flow explained
- [ ] CORS configuration documented
- [ ] Code reviewed
