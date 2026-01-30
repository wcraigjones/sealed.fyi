# Architecture & Parallel Work Streams

This document breaks down the sealed.fyi implementation into sequential phases, each containing parallelizable work streams. Phases must complete before the next begins; streams within a phase can execute concurrently.

**Target: Up to 10 parallel agents per phase.**

---

## Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: Contracts & Schemas (1 stream)                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  1A: Define all interfaces, API contracts, DB schema, test specs       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: Core Implementation (10 streams)                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐     │
│  │ 2A Crypto │ │ 2B PoW    │ │ 2C Token  │ │ 2D Create │ │ 2E Get    │     │
│  │ Library   │ │ Library   │ │ Lambda    │ │ Lambda    │ │ Lambda    │     │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘     │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐     │
│  │ 2F Burn   │ │ 2G Shared │ │ 2H Front  │ │ 2I Front  │ │ 2J Infra  │     │
│  │ Lambda    │ │ Backend   │ │ HTML/CSS  │ │ JS App    │ │ SAM/Local │     │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: Integration & Testing (6 streams)                                 │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐     │
│  │ 3A Wire   │ │ 3B E2E    │ │ 3C Security│ │ 3D API    │ │ 3E Crypto │     │
│  │ Frontend  │ │ Tests     │ │ Tests     │ │ Docs      │ │ Docs      │     │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘     │
│  ┌───────────┐                                                              │
│  │ 3F Threat │                                                              │
│  │ Model Doc │                                                              │
│  └───────────┘                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: Production & Hardening (5 streams)                                │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐     │
│  │ 4A Cloud  │ │ 4B S3 &   │ │ 4C Security│ │ 4D Deploy │ │ 4E Monitor│     │
│  │ Front     │ │ Domain    │ │ Headers   │ │ Scripts   │ │ & Alerts  │     │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Contracts & Schemas

**Goal:** Establish all interfaces and contracts so Phase 2 streams can work independently without coordination.

**Streams:** 1  
**Agents:** 1

### Stream 1A: Define All Contracts

**Deliverables:**

1. `docs/API.md` — Complete REST API specification
2. `docs/CRYPTO.md` — Crypto library interface and algorithms
3. `docs/SCHEMA.md` — DynamoDB schema
4. `docs/TESTING.md` — Test specifications for all components

---

#### API Contract (`docs/API.md`)

```
POST /token
  Request: (none)
  Response: {
    token: string,          // JWT, 5 min TTL (see JWT claims below)
    nonce: string,          // 16 bytes, hex
    powChallenge: {
      difficulty: number,   // Leading zero bits (e.g., 18)
      prefix: string        // "sealed:"
    },
    expiresAt: number       // Unix timestamp
  }

  JWT Claims:
    - jti: string           // Unique token ID (prevents replay)
    - exp: number           // Expiration timestamp (5 min from issue)
    - iat: number           // Issued-at timestamp
    - op: string            // Operation type: "create"
    - nonce: string         // Must match response nonce
    - pow_difficulty: number // PoW difficulty level
    - pow_prefix: string    // PoW prefix string
  
  JWT Algorithm: HS256 (HMAC-SHA256) with server-side secret

POST /secrets
  Headers:
    Authorization: Bearer <token>
    Content-Type: application/json
  Request: {
    ciphertext: string,     // base64
    iv: string,             // base64, 12 bytes
    salt: string | null,    // base64, 16 bytes, if passphrase-protected
    nonce: string,          // Must match token nonce
    pow: string,            // PoW solution
    ttl: number,            // Seconds (900 to 7776000)
    maxViews: number,       // 1-5
    passphraseProtected: boolean
  }
  Response (201): {
    id: string,             // 22-char base64url
    burnToken: string,      // 32-char hex
    expiresAt: number       // Unix timestamp
  }
  Response (400): { error: "invalid_request", message: string }
  Response (401): { error: "invalid_token" }
  Response (403): { error: "invalid_pow" }

GET /secrets/{id}
  Query Parameters:
    accessToken: string     // Optional: idempotency token from previous access
  Response (200): {
    ciphertext: string,     // base64
    iv: string,             // base64
    salt: string | null,    // base64, if passphrase-protected
    passphraseProtected: boolean,
    accessToken: string     // Idempotency token (valid for 30 sec re-fetch)
  }
  Response (404): { error: "not_available" }
  // CRITICAL: 404 returned for missing, expired, AND consumed — identical response
  
  Idempotency: If accessToken matches lastAccessToken AND within 30 sec window,
  return secret without decrementing remainingViews (tolerates refresh/prefetch)

DELETE /secrets/{id}
  Headers:
    X-Burn-Token: <token>
  Response: 204 No Content (ALWAYS, even if already deleted)
```

---

#### Crypto Contract (`docs/CRYPTO.md`)

```typescript
// ============ TYPES ============

interface EncryptedPayload {
  ciphertext: string   // base64
  iv: string           // base64, 12 bytes
}

interface EncryptedSecret extends EncryptedPayload {
  salt: string | null  // base64, 16 bytes, present if passphrase-protected
}

interface PowChallenge {
  difficulty: number
  prefix: string
}

// ============ CRYPTO FUNCTIONS ============

// Generate a random 256-bit AES key
function generateKey(): Promise<CryptoKey>

// Encrypt plaintext with AES-256-GCM
function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedPayload>

// Decrypt ciphertext with AES-256-GCM
function decrypt(ciphertext: string, iv: string, key: CryptoKey): Promise<string>

// Derive key from passphrase using PBKDF2-SHA256 (100,000 iterations)
function deriveKeyFromPassphrase(passphrase: string, salt: string): Promise<CryptoKey>

// Generate random salt (16 bytes)
function generateSalt(): string  // Returns base64

// Export key to base64url for URL fragment
function keyToBase64Url(key: CryptoKey): Promise<string>

// Import key from base64url
function base64UrlToKey(encoded: string): Promise<CryptoKey>

// ============ HIGH-LEVEL API ============

// Encrypt a secret, optionally with passphrase
// Returns payload for server + fragment for URL
function encryptSecret(
  plaintext: string,
  passphrase?: string
): Promise<{
  payload: EncryptedSecret,
  urlFragment: string
}>

// Decrypt a secret using URL fragment and optional passphrase
function decryptSecret(
  payload: EncryptedSecret,
  urlFragment: string,
  passphrase?: string
): Promise<string>

// ============ POW FUNCTIONS ============

// Solve a PoW challenge (SHA-256 with leading zeros)
function solveChallenge(nonce: string, challenge: PowChallenge): Promise<string>

// Verify a PoW solution
function verifyChallenge(nonce: string, solution: string, challenge: PowChallenge): boolean
```

---

#### DynamoDB Schema (`docs/SCHEMA.md`)

```
Table: sealed-secrets
Primary Key: id (String)

Attributes:
  id                  : S   # 22-char base64url, partition key
  ciphertext          : S   # base64-encoded encrypted payload
  iv                  : S   # base64-encoded, 12 bytes
  salt                : S   # base64-encoded, 16 bytes (nullable)
  passphraseProtected : BOOL
  remainingViews      : N   # Decremented on each GET
  burnToken           : S   # 32-char hex for early deletion
  createdAt           : N   # Unix timestamp (seconds)
  expiresAt           : N   # Unix timestamp (seconds) — TTL attribute
  lastAccessAt        : N   # Unix timestamp of last access (for idempotency window)
  lastAccessToken     : S   # Random token from last access (for idempotency window)

TTL: Enabled on `expiresAt` attribute (note: DynamoDB TTL is best-effort, typically within 48 hours)

Note: Application MUST check expiresAt on read to enforce immediate expiration.

GSI: None required
```

---

#### Test Specifications (`docs/TESTING.md`)

Each component must implement these tests:

**Crypto Library Tests:**
- `crypto.test.js`: encrypt/decrypt round-trip
- `crypto.test.js`: wrong key fails decryption
- `crypto.test.js`: passphrase derivation is deterministic
- `crypto.test.js`: base64url encoding round-trip

**PoW Library Tests:**
- `pow.test.js`: solve produces valid solution
- `pow.test.js`: verify accepts valid solution
- `pow.test.js`: verify rejects invalid solution

**Lambda Tests (each Lambda):**
- Unit tests with mocked DynamoDB
- Input validation tests
- Error response tests

**E2E Tests:**
- Full create → retrieve flow
- Passphrase-protected flow
- Expiration flow
- Burn flow
- Anti-oracle verification (identical 404s)

---

**Exit Criteria:** All four docs complete. Contracts frozen. Phase 2 can begin.

---

## Phase 2: Core Implementation

**Goal:** Implement all components in parallel. Each stream works against the frozen contracts from Phase 1.

**Streams:** 10  
**Agents:** 10

---

### Stream 2A: Crypto Library

**Agent Assignment:** Agent A  
**File:** `frontend/js/crypto.js`  
**Test File:** `frontend/js/crypto.test.js`

**Scope:**
- Implement all functions from `docs/CRYPTO.md` crypto section
- Use Web Crypto API (SubtleCrypto)
- AES-256-GCM for encryption
- PBKDF2-SHA256 (100,000 iterations) for passphrase derivation
- Base64url encoding for URL fragment

**Dependencies:** None (uses browser APIs only)

**Deliverables:**
1. `frontend/js/crypto.js` — all crypto functions
2. `frontend/js/crypto.test.js` — unit tests
3. Tests passing

---

### Stream 2B: Proof-of-Work Library

**Agent Assignment:** Agent B  
**File:** `frontend/js/pow.js`  
**Test File:** `frontend/js/pow.test.js`

**Scope:**
- Implement `solveChallenge()` and `verifyChallenge()` from `docs/CRYPTO.md`
- SHA-256 hashcash-style: find solution where `SHA256(prefix + nonce + solution)` has N leading zero bits
- Main thread implementation (Web Worker optimization optional)

**Dependencies:** None (uses browser APIs only)

**Deliverables:**
1. `frontend/js/pow.js` — PoW functions
2. `frontend/js/pow.test.js` — unit tests
3. Tests passing

---

### Stream 2C: Create Token Lambda

**Agent Assignment:** Agent C  
**File:** `backend/functions/create-token/index.js`  
**Test File:** `backend/functions/create-token/index.test.js`

**Scope:**
- Generate JWT with 5-minute TTL
- Include random nonce (16 bytes hex)
- Include PoW challenge parameters
- No authentication required
- Uses shared token utilities from Stream 2G

**Interface (from `docs/API.md`):**
```
POST /token → { token, nonce, powChallenge, expiresAt }
```

**Dependencies:** Stream 2G (shared utilities) — can mock initially

**Deliverables:**
1. `backend/functions/create-token/index.js`
2. `backend/functions/create-token/package.json`
3. `backend/functions/create-token/index.test.js`
4. Tests passing

---

### Stream 2D: Create Secret Lambda

**Agent Assignment:** Agent D  
**File:** `backend/functions/create-secret/index.js`  
**Test File:** `backend/functions/create-secret/index.test.js`

**Scope:**
- Validate JWT token (not expired, nonce matches)
- Verify PoW solution
- Validate request body (size limits, TTL bounds, maxViews bounds)
- Generate high-entropy secret ID (22 chars base64url)
- Generate burn token (32 chars hex)
- Store in DynamoDB
- Return secret ID, burn token, expiration

**Interface (from `docs/API.md`):**
```
POST /secrets → { id, burnToken, expiresAt }
```

**Dependencies:** Stream 2G (shared utilities) — can mock initially

**Deliverables:**
1. `backend/functions/create-secret/index.js`
2. `backend/functions/create-secret/package.json`
3. `backend/functions/create-secret/index.test.js`
4. Tests passing

---

### Stream 2E: Get Secret Lambda

**Agent Assignment:** Agent E  
**File:** `backend/functions/get-secret/index.js`  
**Test File:** `backend/functions/get-secret/index.test.js`

**Scope:**
- Fetch secret by ID from DynamoDB
- Check if exists and not expired
- Decrement `remainingViews`
- Delete if `remainingViews` reaches 0
- Return ciphertext, iv, salt, passphraseProtected
- **CRITICAL:** Return identical 404 for missing, expired, consumed

**Interface (from `docs/API.md`):**
```
GET /secrets/{id} → { ciphertext, iv, salt, passphraseProtected } | { error: "not_available" }
```

**Dependencies:** Stream 2G (shared utilities) — can mock initially

**Deliverables:**
1. `backend/functions/get-secret/index.js`
2. `backend/functions/get-secret/package.json`
3. `backend/functions/get-secret/index.test.js`
4. Tests passing with anti-oracle verification

---

### Stream 2F: Burn Secret Lambda

**Agent Assignment:** Agent F  
**File:** `backend/functions/burn-secret/index.js`  
**Test File:** `backend/functions/burn-secret/index.test.js`

**Scope:**
- Validate burn token from header
- Delete secret from DynamoDB if token matches
- **CRITICAL:** Always return 204, even if secret doesn't exist or token is wrong (no oracle)

**Interface (from `docs/API.md`):**
```
DELETE /secrets/{id} → 204 No Content (always)
```

**Dependencies:** Stream 2G (shared utilities) — can mock initially

**Deliverables:**
1. `backend/functions/burn-secret/index.js`
2. `backend/functions/burn-secret/package.json`
3. `backend/functions/burn-secret/index.test.js`
4. Tests passing

---

### Stream 2G: Shared Backend Utilities

**Agent Assignment:** Agent G  
**Directory:** `backend/functions/shared/`

**Scope:**
- `dynamo.js` — DynamoDB client helpers (get, put, delete, decrement)
- `token.js` — JWT generation and validation
- `pow.js` — Server-side PoW verification
- `responses.js` — Uniform response builders (success, notAvailable, badRequest)
- `validation.js` — Input validation helpers

**Deliverables:**
1. `backend/functions/shared/dynamo.js`
2. `backend/functions/shared/token.js`
3. `backend/functions/shared/pow.js`
4. `backend/functions/shared/responses.js`
5. `backend/functions/shared/validation.js`
6. `backend/functions/shared/index.js` (exports all)
7. Unit tests for each module

---

### Stream 2H: Frontend HTML & CSS

**Agent Assignment:** Agent H  
**Files:** `frontend/index.html`, `frontend/css/style.css`

**Scope:**
- Semantic HTML structure with view sections (hidden by default)
- Views: create, link-generated, reveal, passphrase-prompt, status/error
- Clean, minimal CSS
- Mobile responsive
- Accessibility (labels, focus states, ARIA)
- No JavaScript — just structure and style

**View Sections:**
```html
<section id="view-create">...</section>
<section id="view-link">...</section>
<section id="view-reveal">...</section>
<section id="view-passphrase">...</section>
<section id="view-status">...</section>
```

**Deliverables:**
1. `frontend/index.html`
2. `frontend/css/style.css`
3. All views render correctly (manually toggle `display` to verify)

---

### Stream 2I: Frontend JavaScript Application

**Agent Assignment:** Agent I  
**Files:** `frontend/js/app.js`, `frontend/js/api.js`, `frontend/js/storage.js`

**Scope:**

**`app.js`** — Main application logic:
- View routing (show/hide sections based on state)
- Form event handlers
- State management
- Orchestrates crypto, api, storage modules
- URL fragment parsing for reveal flow

**`api.js`** — API client:
- `getToken()` — POST /token
- `createSecret(request)` — POST /secrets
- `getSecret(id)` — GET /secrets/{id}
- `burnSecret(id, burnToken)` — DELETE /secrets/{id}
- Error handling, response parsing

**`storage.js`** — LocalStorage wrapper:
- `getPreferences()` — { ttl, maxViews, usePassphrase }
- `setPreferences(prefs)`
- Defaults if not set

**Dependencies:** Crypto (2A), PoW (2B) — can mock initially

**Deliverables:**
1. `frontend/js/app.js`
2. `frontend/js/api.js`
3. `frontend/js/storage.js`
4. Application flow works with mocked crypto/API

---

### Stream 2J: Infrastructure & Local Dev

**Agent Assignment:** Agent J  
**Files:** `backend/template.yaml`, `backend/samconfig.toml`, `scripts/local-setup.sh`

**Scope:**

**`template.yaml`** — SAM/CloudFormation:
- DynamoDB table with TTL enabled
- HTTP API Gateway with CORS
- Lambda functions (create-token, create-secret, get-secret, burn-secret)
- IAM roles and policies
- Environment variables

**`samconfig.toml`** — SAM deployment config

**`scripts/local-setup.sh`** — Local development:
- Start DynamoDB Local (Docker)
- Create table
- Start SAM local API
- Seed test data (optional)

**Deliverables:**
1. `backend/template.yaml`
2. `backend/samconfig.toml`
3. `scripts/local-setup.sh`
4. `sam local start-api` works with DynamoDB Local

---

**Phase 2 Exit Criteria:**
- All 10 streams complete
- All unit tests passing
- SAM local API starts successfully
- Frontend renders all views
- Components work in isolation (with mocks where needed)

---

## Phase 3: Integration & Testing

**Goal:** Wire components together, verify end-to-end flows, complete documentation.

**Streams:** 6  
**Agents:** 6

---

### Stream 3A: Wire Frontend to Backend

**Agent Assignment:** Agent A  
**Scope:**
- Connect `api.js` to real SAM local endpoint
- Connect `app.js` to real crypto.js and pow.js
- Verify create flow: form → encrypt → PoW → submit → display link
- Verify reveal flow: parse URL → fetch → decrypt → display
- Fix integration bugs

**Deliverables:**
1. Frontend fully functional with local backend
2. All flows working end-to-end

---

### Stream 3B: E2E Test Suite

**Agent Assignment:** Agent B  
**Directory:** `tests/e2e/`

**Scope:**
Write and run E2E tests (can use Playwright, Puppeteer, or shell scripts with curl):

```
tests/e2e/
  create-retrieve.test.js    # Basic flow
  multiple-views.test.js     # maxViews > 1
  passphrase.test.js         # Passphrase-protected secrets
  expiration.test.js         # TTL enforcement
  burn.test.js               # Early deletion
  anti-oracle.test.js        # Verify identical 404s
```

**Test Cases:**
1. Create secret → retrieve → content matches
2. Create with maxViews=3 → retrieve 3 times → 4th fails
3. Create with passphrase → retrieve with correct passphrase → success
4. Create with passphrase → retrieve with wrong passphrase → fails
5. Create with short TTL → wait → retrieve fails
6. Create → burn → retrieve fails
7. Retrieve non-existent ID → 404
8. Retrieve expired → 404 (identical to non-existent)
9. Retrieve consumed → 404 (identical to non-existent)

**Deliverables:**
1. `tests/e2e/*.test.js`
2. All tests passing
3. CI-compatible test runner

---

### Stream 3C: Security Test Suite

**Agent Assignment:** Agent C  
**Directory:** `tests/security/`

**Scope:**
Security-focused tests:

1. **No key leakage:** Verify URL fragment never appears in:
   - Server request logs
   - Network requests (check via proxy)
   - LocalStorage
   
2. **Anti-oracle:** Response timing and size identical for:
   - Missing secret
   - Expired secret
   - Consumed secret

3. **Token security:**
   - Expired token rejected
   - Replayed nonce rejected
   - Invalid PoW rejected

4. **Input validation:**
   - Oversized payload rejected
   - Invalid TTL rejected
   - Invalid maxViews rejected

**Deliverables:**
1. `tests/security/*.test.js`
2. All tests passing
3. Security checklist documented

---

### Stream 3D: API Documentation

**Agent Assignment:** Agent D  
**File:** `docs/API.md`

**Scope:**
Expand API docs with:
- Full request/response examples
- Error code reference
- Rate limiting documentation
- CORS configuration
- Authentication flow diagram

**Deliverables:**
1. Complete `docs/API.md`

---

### Stream 3E: Crypto Documentation

**Agent Assignment:** Agent E  
**File:** `docs/CRYPTO.md`

**Scope:**
Expand crypto docs with:
- Algorithm rationale (why AES-256-GCM, why PBKDF2)
- Key derivation parameters
- Security considerations
- Code examples
- Test vectors for interoperability

**Deliverables:**
1. Complete `docs/CRYPTO.md`

---

### Stream 3F: Threat Model Documentation

**Agent Assignment:** Agent F  
**File:** `docs/THREAT_MODEL.md`

**Scope:**
Comprehensive threat model:
- Assets (secrets, keys, tokens)
- Threat actors (passive observer, active attacker, malicious server)
- Attack vectors and mitigations
- Trust boundaries diagram
- Residual risks
- Security assumptions

**Deliverables:**
1. Complete `docs/THREAT_MODEL.md`

---

**Phase 3 Exit Criteria:**
- Frontend wired to backend, all flows working
- All E2E tests passing
- All security tests passing
- Documentation complete

---

## Phase 4: Production & Hardening

**Goal:** Production deployment with security hardening.

**Streams:** 5  
**Agents:** 5

---

### Stream 4A: CloudFront Distribution

**Agent Assignment:** Agent A  
**File:** `infrastructure/cloudfront.yaml`

**Scope:**
- CloudFront distribution for frontend
- HTTPS only
- Custom error pages
- Cache behaviors (static assets cached, HTML no-cache)

**Deliverables:**
1. `infrastructure/cloudfront.yaml`
2. Distribution deploys successfully

---

### Stream 4B: S3 & Domain Setup

**Agent Assignment:** Agent B  
**Files:** `infrastructure/s3.yaml`, `infrastructure/route53.yaml`

**Scope:**
- S3 bucket for frontend static files
- Bucket policy (CloudFront access only)
- Route53 hosted zone (if managing DNS)
- ACM certificate for sealed.fyi

**Deliverables:**
1. `infrastructure/s3.yaml`
2. `infrastructure/route53.yaml` (or DNS instructions)
3. SSL certificate provisioned

---

### Stream 4C: Security Headers

**Agent Assignment:** Agent C  
**File:** `infrastructure/security-headers.js`

**Scope:**
CloudFront Function or Lambda@Edge for security headers:

```javascript
// Base headers for all responses
const baseHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.sealed.fyi; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
}

// Cache-Control varies by content type:
// - HTML (index.html): 'no-store' (always fetch fresh, no local traces)
// - API responses: 'no-store' (sensitive data)
// - Static assets (JS, CSS): 'public, max-age=31536000, immutable' (cache with versioned filenames)
```

**Deliverables:**
1. `infrastructure/security-headers.js`
2. Headers verified on deployed site

---

### Stream 4D: Deployment Scripts

**Agent Assignment:** Agent D  
**Directory:** `scripts/`

**Scope:**
- `scripts/deploy-backend.sh` — Deploy SAM stack
- `scripts/deploy-frontend.sh` — Build and sync to S3, invalidate CloudFront
- `scripts/deploy-all.sh` — Full deployment
- `scripts/rollback.sh` — Rollback to previous version

**Deliverables:**
1. `scripts/deploy-backend.sh`
2. `scripts/deploy-frontend.sh`
3. `scripts/deploy-all.sh`
4. `scripts/rollback.sh`
5. Deployment tested end-to-end

---

### Stream 4E: Monitoring & Alerts

**Agent Assignment:** Agent E  
**File:** `infrastructure/monitoring.yaml`

**Scope:**
- CloudWatch dashboards
- Lambda error alarms
- API Gateway 5xx alarms
- DynamoDB throttling alarms
- Log retention policies (minimize, short TTL)

**Deliverables:**
1. `infrastructure/monitoring.yaml`
2. Alarms configured and tested

---

**Phase 4 Exit Criteria:**
- Application deployed to production
- Accessible at https://sealed.fyi
- All security headers present
- Monitoring active
- Deployment scripts documented

---

## Summary: Phases, Streams, and Parallelism

| Phase | Description | Streams | Max Parallel Agents |
|-------|-------------|---------|---------------------|
| 1 | Contracts & Schemas | 1 | 1 |
| 2 | Core Implementation | 10 | **10** |
| 3 | Integration & Testing | 6 | 6 |
| 4 | Production & Hardening | 5 | 5 |

---

## Agent Assignment Matrix

### Phase 1 (1 agent)
| Stream | Agent | Deliverable |
|--------|-------|-------------|
| 1A | Agent 1 | docs/API.md, docs/CRYPTO.md, docs/SCHEMA.md, docs/TESTING.md |

### Phase 2 (10 agents)
| Stream | Agent | Deliverable |
|--------|-------|-------------|
| 2A | Agent 1 | frontend/js/crypto.js |
| 2B | Agent 2 | frontend/js/pow.js |
| 2C | Agent 3 | backend/functions/create-token/ |
| 2D | Agent 4 | backend/functions/create-secret/ |
| 2E | Agent 5 | backend/functions/get-secret/ |
| 2F | Agent 6 | backend/functions/burn-secret/ |
| 2G | Agent 7 | backend/functions/shared/ |
| 2H | Agent 8 | frontend/index.html, frontend/css/style.css |
| 2I | Agent 9 | frontend/js/app.js, frontend/js/api.js, frontend/js/storage.js |
| 2J | Agent 10 | backend/template.yaml, scripts/local-setup.sh |

### Phase 3 (6 agents)
| Stream | Agent | Deliverable |
|--------|-------|-------------|
| 3A | Agent 1 | Wire frontend to backend |
| 3B | Agent 2 | tests/e2e/ |
| 3C | Agent 3 | tests/security/ |
| 3D | Agent 4 | docs/API.md (expanded) |
| 3E | Agent 5 | docs/CRYPTO.md (expanded) |
| 3F | Agent 6 | docs/THREAT_MODEL.md |

### Phase 4 (5 agents)
| Stream | Agent | Deliverable |
|--------|-------|-------------|
| 4A | Agent 1 | infrastructure/cloudfront.yaml |
| 4B | Agent 2 | infrastructure/s3.yaml, domain setup |
| 4C | Agent 3 | infrastructure/security-headers.js |
| 4D | Agent 4 | scripts/deploy-*.sh |
| 4E | Agent 5 | infrastructure/monitoring.yaml |

---

## Coordination Requirements

### Phase 1 → Phase 2
- Contracts frozen before Phase 2 begins
- All agents receive identical contract documents

### Within Phase 2
- Streams 2C, 2D, 2E, 2F depend on 2G (shared utilities)
  - **Mitigation:** 2G provides interfaces first; implementations can be mocked
- Stream 2I depends on 2A, 2B (crypto, PoW)
  - **Mitigation:** 2I can mock crypto/PoW initially
- No other dependencies — maximum parallelism

### Phase 2 → Phase 3
- All components complete before integration begins
- Unit tests passing

### Within Phase 3
- Stream 3A must complete before 3B, 3C can run full E2E tests
  - **Mitigation:** 3B, 3C can write tests while 3A wires; run tests after
- 3D, 3E, 3F are documentation — fully parallel

### Phase 3 → Phase 4
- Integration complete, all tests passing
- Ready for production deployment

### Within Phase 4
- 4A (CloudFront) and 4B (S3/Domain) should complete before 4D (deploy scripts)
- 4C (security headers) can run in parallel
- 4E (monitoring) can run in parallel
