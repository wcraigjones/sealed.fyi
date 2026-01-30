# API Contract

## Overview

sealed.fyi exposes a REST API for secret management. The API is designed with these principles:

- **Stateless authentication** via short-lived JWTs
- **Anti-abuse** via proof-of-work
- **Anti-oracle** via uniform error responses
- **Minimal metadata** collection

## Base URL

- **Production**: `https://api.sealed.fyi`
- **Local Development**: `http://localhost:3000`

## Authentication

Secret creation requires a short-lived authorization token obtained from `POST /token`. The token:
- Expires in 5 minutes
- Contains a single-use nonce
- Binds to a proof-of-work challenge
- Is not tied to any identity

Secret retrieval and deletion do not require authentication (possession of the secret ID or burn token is sufficient).

---

## Endpoints

### POST /token

Request an authorization token for creating a secret.

**Request**
```http
POST /token
Content-Type: application/json
```

No request body required.

**Response (200 OK)**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "nonce": "a1b2c3d4e5f67890a1b2c3d4e5f67890",
  "powChallenge": {
    "difficulty": 18,
    "prefix": "sealed:"
  },
  "expiresAt": 1706745600
}
```

**Response Fields**
| Field | Type | Description |
|-------|------|-------------|
| `token` | string | JWT for authorizing secret creation |
| `nonce` | string | 16 bytes hex (32 chars), single-use |
| `powChallenge.difficulty` | number | Leading zero bits required in PoW hash |
| `powChallenge.prefix` | string | Prefix for PoW hash input |
| `expiresAt` | number | Unix timestamp when token expires |

**JWT Claims**
| Claim | Type | Description |
|-------|------|-------------|
| `jti` | string | Unique token ID (UUID) |
| `iat` | number | Issued-at timestamp |
| `exp` | number | Expiration timestamp (iat + 300) |
| `op` | string | Operation type: `"create"` |
| `nonce` | string | Must match response nonce |
| `pow_difficulty` | number | PoW difficulty level |
| `pow_prefix` | string | PoW prefix string |

**JWT Algorithm**: HS256 (HMAC-SHA256) with server-side secret

**Rate Limiting**: 10 requests per minute per IP

---

### POST /secrets

Create a new encrypted secret.

**Request**
```http
POST /secrets
Authorization: Bearer <token>
Content-Type: application/json

{
  "ciphertext": "base64-encoded-ciphertext...",
  "iv": "base64-encoded-iv...",
  "salt": "base64-encoded-salt-or-null",
  "nonce": "a1b2c3d4e5f67890a1b2c3d4e5f67890",
  "pow": "12345678",
  "ttl": 86400,
  "maxViews": 1,
  "passphraseProtected": false
}
```

**Request Fields**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ciphertext` | string | Yes | Base64-encoded encrypted payload (max 68 KB) |
| `iv` | string | Yes | Base64-encoded initialization vector (12 bytes) |
| `salt` | string \| null | Yes | Base64-encoded salt (16 bytes) if passphrase-protected, otherwise `null` |
| `nonce` | string | Yes | Must match token nonce exactly |
| `pow` | string | Yes | Proof-of-work solution |
| `ttl` | number | Yes | Time-to-live in seconds (900 to 7776000) |
| `maxViews` | number | Yes | Maximum retrievals allowed (1 to 5) |
| `passphraseProtected` | boolean | Yes | Whether secret requires passphrase to decrypt |

**TTL Range**
- Minimum: 900 seconds (15 minutes)
- Maximum: 7776000 seconds (90 days)
- Any integer value within this range is accepted

**Suggested UI Presets**
| Value | Duration |
|-------|----------|
| 900 | 15 minutes |
| 3600 | 1 hour |
| 86400 | 1 day |
| 604800 | 7 days |
| 2592000 | 30 days |
| 7776000 | 90 days |

**Response (201 Created)**
```json
{
  "id": "Ab3dEf6hIj9kLmNoPqRs",
  "burnToken": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  "expiresAt": 1706832000
}
```

**Response Fields**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Secret identifier (22 chars, base64url) |
| `burnToken` | string | Token for early deletion (32 chars, hex) |
| `expiresAt` | number | Unix timestamp when secret expires |

**Error Responses**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{"error": "invalid_request", "message": "..."}` | Validation failed |
| 401 | `{"error": "invalid_token"}` | Token missing, expired, or invalid |
| 403 | `{"error": "invalid_pow"}` | Proof-of-work solution incorrect |

**Validation Rules**
- `ciphertext`: Max 68 KB (base64), must be valid base64
- `iv`: Exactly 12 bytes (16 chars base64)
- `salt`: Exactly 16 bytes (24 chars base64) or `null`
- `nonce`: Must match token nonce
- `ttl`: 900 ≤ ttl ≤ 7776000
- `maxViews`: 1 ≤ maxViews ≤ 5

---

### GET /secrets/{id}

Retrieve an encrypted secret.

**Request**
```http
GET /secrets/Ab3dEf6hIj9kLmNoPqRs?accessToken=optional
```

**Path Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Secret identifier |

**Query Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accessToken` | string | No | Idempotency token from previous access |

**Response (200 OK)**
```json
{
  "ciphertext": "base64-encoded-ciphertext...",
  "iv": "base64-encoded-iv...",
  "salt": "base64-encoded-salt-or-null",
  "passphraseProtected": false,
  "accessToken": "x1y2z3..."
}
```

**Response Fields**
| Field | Type | Description |
|-------|------|-------------|
| `ciphertext` | string | Base64-encoded encrypted payload |
| `iv` | string | Base64-encoded initialization vector |
| `salt` | string \| null | Base64-encoded salt if passphrase-protected |
| `passphraseProtected` | boolean | Whether passphrase is required for decryption |
| `accessToken` | string | Idempotency token (valid for 30 sec re-fetch) |

**Response (404 Not Found)**
```json
{
  "error": "not_available"
}
```

**Response Headers**
```
Cache-Control: no-store
```

**Anti-Oracle Behavior**

The 404 response is returned for ALL of these cases with **identical** response body, status code, headers, and timing:
- Secret does not exist
- Secret has expired
- Secret has been consumed (all views used)
- Secret has been burned
- Malformed or invalid ID format

This prevents attackers from determining the state of a secret or probing for valid ID formats.

**Idempotency Window**

If `accessToken` is provided and matches the previous access within 30 seconds:
- Secret is returned without decrementing `remainingViews`
- Tolerates browser refresh, prefetch, or retry

If `accessToken` is missing or doesn't match:
- `remainingViews` is decremented
- New `accessToken` is generated
- If `remainingViews` reaches 0, secret is deleted

---

### DELETE /secrets/{id}

Burn (delete) a secret early.

**Request**
```http
DELETE /secrets/Ab3dEf6hIj9kLmNoPqRs
X-Burn-Token: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
```

**Headers**
| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `X-Burn-Token` | string | Yes | Burn token received at creation |

**Response**

**Always returns 204 No Content**, regardless of:
- Whether the secret exists
- Whether the burn token is valid
- Whether the secret was already deleted

This prevents attackers from probing secret existence.

---

## Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 400 | `invalid_request` | Request validation failed |
| 401 | `invalid_token` | Authorization token invalid or expired |
| 403 | `invalid_pow` | Proof-of-work solution incorrect |
| 404 | `not_available` | Secret not available (any reason) |

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /token | 10 | 1 minute |
| POST /secrets | Via PoW | N/A |
| GET /secrets/{id} | 60 | 1 minute |
| DELETE /secrets/{id} | 10 | 1 minute |

Rate limiting is based on IP address. Minimal data is retained.

---

## CORS Configuration

**Allowed Origins**
- `https://sealed.fyi`
- `http://localhost:3000` (development only)

**Allowed Methods**
- GET, POST, DELETE, OPTIONS

**Allowed Headers**
- `Authorization`
- `Content-Type`
- `X-Burn-Token`

**Exposed Headers**
- None (no sensitive headers exposed)

---

## Examples

### Create a Secret (cURL)

```bash
# 1. Get token
TOKEN_RESPONSE=$(curl -s -X POST https://api.sealed.fyi/token)
TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.token')
NONCE=$(echo $TOKEN_RESPONSE | jq -r '.nonce')

# 2. Solve PoW (client-side, not shown)

# 3. Create secret
curl -X POST https://api.sealed.fyi/secrets 
  -H "Authorization: Bearer $TOKEN" 
  -H "Content-Type: application/json" 
  -d '{
    "ciphertext": "...",
    "iv": "...",
    "salt": null,
    "nonce": "'$NONCE'",
    "pow": "12345678",
    "ttl": 86400,
    "maxViews": 1,
    "passphraseProtected": false
  }'
```

### Retrieve a Secret (cURL)

```bash
curl -s https://api.sealed.fyi/secrets/Ab3dEf6hIj9kLmNoPqRs
```

### Burn a Secret (cURL)

```bash
curl -X DELETE https://api.sealed.fyi/secrets/Ab3dEf6hIj9kLmNoPqRs 
  -H "X-Burn-Token: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
```

### JavaScript Fetch Example

```javascript
// Get token
const tokenRes = await fetch('https://api.sealed.fyi/token', { method: 'POST' });
const { token, nonce, powChallenge } = await tokenRes.json();

// Solve PoW
const pow = await solveChallenge(nonce, powChallenge);

// Create secret
const createRes = await fetch('https://api.sealed.fyi/secrets', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ciphertext,
    iv,
    salt: null,
    nonce,
    pow,
    ttl: 86400,
    maxViews: 1,
    passphraseProtected: false
  })
});

const { id, burnToken } = await createRes.json();
```
