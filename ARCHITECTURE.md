# Architecture & Parallel Work Streams

This document breaks down the sealed.fyi implementation into sequential phases, each containing parallelizable work streams. Phases must complete before the next begins; streams within a phase can execute concurrently.

---

## Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: Contracts & Schemas                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Stream 1A: Define all interfaces, API contracts, DB schema            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: Core Libraries                                                    │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                   │
│  │  Stream 2A: Crypto Lib  │  │  Stream 2B: PoW Lib     │                   │
│  │  (frontend/js/crypto.js)│  │  (frontend/js/pow.js)   │                   │
│  └─────────────────────────┘  └─────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: Backend & Frontend Shell                                          │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                   │
│  │  Stream 3A: Backend     │  │  Stream 3B: Frontend    │                   │
│  │  Lambdas + Infra        │  │  UI Shell + Views       │                   │
│  └─────────────────────────┘  └─────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: Integration                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Stream 4A: Wire frontend to backend, E2E testing, security audit      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 5: Hardening & Deploy                                                │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                   │
│  │  Stream 5A: Security    │  │  Stream 5B: Production  │                   │
│  │  Headers & CSP          │  │  Deployment             │                   │
│  └─────────────────────────┘  └─────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Contracts & Schemas

**Goal:** Establish all interfaces and contracts so subsequent phases can work independently.

**Streams:** 1 (sequential prerequisite)

### Stream 1A: Define Contracts

**Deliverables:**

1. `docs/API.md` — Complete API specification
2. `docs/CRYPTO.md` — Crypto library interface and design
3. `docs/SCHEMA.md` — DynamoDB schema

#### API Contract (`docs/API.md`)

```
POST /token
  Response: { token, nonce, powChallenge: { difficulty, prefix }, expiresAt }

POST /secrets
  Headers: Authorization: Bearer <token>
  Request: { ciphertext, iv, salt?, nonce, pow, ttl, maxViews, passphraseProtected }
  Response: { id, burnToken?, expiresAt }

GET /secrets/{id}
  Response (success): { ciphertext, iv, salt?, passphraseProtected }
  Response (not available): { error: "not_available" }  ← IDENTICAL for missing/expired/consumed

DELETE /secrets/{id}
  Headers: X-Burn-Token: <token>
  Response: 204 (always)
```

#### Crypto Contract (`docs/CRYPTO.md`)

```typescript
// Types
interface EncryptedPayload {
  ciphertext: Uint8Array
  iv: Uint8Array
  salt?: Uint8Array  // Present if passphrase-protected
}

// Functions
generateKey(): Promise<CryptoKey>
encrypt(plaintext: string, key: CryptoKey): Promise<{ ciphertext: Uint8Array, iv: Uint8Array }>
decrypt(ciphertext: Uint8Array, iv: Uint8Array, key: CryptoKey): Promise<string>
deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey>
generateSalt(): Uint8Array
keyToBase64Url(key: CryptoKey): Promise<string>
base64UrlToKey(encoded: string): Promise<CryptoKey>
```

#### PoW Contract (`docs/CRYPTO.md`)

```typescript
interface PowChallenge {
  difficulty: number  // Number of leading zero bits required
  prefix: string      // e.g., "sealed:"
}

solveChallenge(nonce: string, challenge: PowChallenge): Promise<string>
verifyChallenge(nonce: string, solution: string, challenge: PowChallenge): boolean
```

#### DynamoDB Schema (`docs/SCHEMA.md`)

```
Table: sealed-secrets
Primary Key: id (String)

Attributes:
  id: string                  # 22-char base64url
  ciphertext: string          # base64-encoded
  iv: string                  # base64-encoded
  salt: string | null         # base64-encoded, if passphrase-protected
  passphraseProtected: boolean
  remainingViews: number
  burnToken: string | null
  createdAt: number           # Unix timestamp (seconds)
  expiresAt: number           # Unix timestamp (seconds) — TTL attribute
```

**Exit Criteria:** All three docs written and reviewed. No implementation begins until contracts are frozen.

---

## Phase 2: Core Libraries

**Goal:** Implement standalone crypto and PoW libraries that have no external dependencies.

**Streams:** 2 (parallel)

**Dependencies:** Phase 1 contracts

### Stream 2A: Crypto Library

**File:** `frontend/js/crypto.js`

**Scope:**
- AES-256-GCM encryption/decryption using Web Crypto API
- PBKDF2 key derivation for passphrase protection
- Base64url encoding for URL fragment
- All functions per contract in `docs/CRYPTO.md`

**Test file:** `frontend/js/crypto.test.js`

**Tests required:**
- Encrypt/decrypt round-trip
- Passphrase derivation determinism (same passphrase + salt = same key)
- Base64url encoding round-trip
- Decryption fails with wrong key
- Decryption fails with wrong passphrase

### Stream 2B: Proof-of-Work Library

**File:** `frontend/js/pow.js`

**Scope:**
- SHA-256 hashcash-style PoW
- Solve challenge (find nonce that produces hash with N leading zero bits)
- Verify solution
- Optional: Web Worker wrapper for non-blocking solve

**Test file:** `frontend/js/pow.test.js`

**Tests required:**
- Solve produces valid solution
- Verify accepts valid solution
- Verify rejects invalid solution
- Difficulty scaling works correctly

**Exit Criteria:** Both libraries implemented with passing tests. Libraries are standalone and can be tested in isolation.

---

## Phase 3: Backend & Frontend Shell

**Goal:** Build the backend API and frontend UI. They communicate via the contracts defined in Phase 1.

**Streams:** 2 (parallel)

**Dependencies:** Phase 1 contracts, Phase 2 libraries

### Stream 3A: Backend + Infrastructure

**Scope:**

1. **SAM Template** (`backend/template.yaml`)
   - DynamoDB table with TTL
   - API Gateway (HTTP API)
   - Lambda functions
   - IAM roles

2. **Lambda: create-token** (`backend/functions/create-token/`)
   - Generate short-lived JWT with nonce
   - Include PoW challenge parameters
   - No authentication required

3. **Lambda: create-secret** (`backend/functions/create-secret/`)
   - Validate token (not expired, not replayed)
   - Verify PoW solution
   - Store encrypted payload in DynamoDB
   - Return secret ID and optional burn token

4. **Lambda: get-secret** (`backend/functions/get-secret/`)
   - Fetch secret by ID
   - Decrement remaining views
   - Delete if views exhausted
   - Return uniform error for missing/expired/consumed

5. **Lambda: burn-secret** (`backend/functions/burn-secret/`)
   - Validate burn token
   - Delete secret
   - Return 204 always

6. **Shared utilities** (`backend/functions/shared/`)
   - DynamoDB helpers
   - Token generation/validation
   - PoW verification (server-side)
   - Uniform response formatting

7. **Local dev script** (`scripts/local-setup.sh`)
   - Start DynamoDB Local
   - Create table
   - Start SAM local API

**Test approach:** Integration tests against local SAM + DynamoDB Local

### Stream 3B: Frontend UI Shell

**Scope:**

1. **HTML structure** (`frontend/index.html`)
   - View sections: create, link-generated, reveal, status
   - Semantic markup, accessibility

2. **Styling** (`frontend/css/style.css`)
   - Clean, minimal design
   - Mobile responsive
   - Dark/light mode (optional)

3. **App logic** (`frontend/js/app.js`)
   - View routing (show/hide sections)
   - Form handling
   - State management

4. **API client** (`frontend/js/api.js`)
   - Fetch wrapper for all endpoints
   - Error handling

5. **Storage** (`frontend/js/storage.js`)
   - LocalStorage wrapper for preferences
   - Remember last TTL, max views, passphrase toggle

6. **Views to implement:**

   **Create View:**
   - Secret textarea (with character count)
   - TTL dropdown (15 min, 1 hr, 1 day, 7 days, 30 days, 90 days)
   - Max views dropdown (1-5)
   - Passphrase checkbox + input
   - Create button
   - Loading state during PoW

   **Link View:**
   - Display generated URL
   - Copy button
   - Warning: "This link can only be viewed N time(s)"
   - Optional: show burn link

   **Reveal View:**
   - "Click to reveal" button (no auto-fetch)
   - Passphrase input (if required)
   - Secret display (after reveal)
   - Copy secret button

   **Status Views:**
   - Loading spinner
   - Error states
   - "Secret not available" (uniform message)

**Test approach:** Manual testing with mocked API initially, then real API in Phase 4

**Exit Criteria:** Backend deploys locally and responds correctly to all endpoints. Frontend renders all views and handles state transitions.

---

## Phase 4: Integration

**Goal:** Wire frontend to backend, verify end-to-end flows, fix bugs.

**Streams:** 1 (sequential — needs both Phase 3 streams complete)

### Stream 4A: Integration & E2E Testing

**Scope:**

1. **Connect frontend to real API**
   - Point `api.js` to local SAM endpoint
   - Verify create flow end-to-end
   - Verify retrieve flow end-to-end

2. **Integration test suite**
   ```
   tests/
     e2e/
       create-retrieve.test.js
       expiration.test.js
       burn.test.js
       anti-oracle.test.js
   ```

3. **Test scenarios:**
   - Create secret → retrieve → verify consumed
   - Create secret → retrieve twice with maxViews=2
   - Create secret → let expire → verify not available
   - Create secret → burn → verify not available
   - Create with passphrase → retrieve with correct passphrase
   - Create with passphrase → retrieve with wrong passphrase (fails)
   - Retrieve non-existent ID → verify "not available"
   - Verify missing/expired/consumed responses are identical

4. **Bug fixes** — address issues found during integration

5. **Idempotency window** — implement short grace period for refresh/prefetch

**Exit Criteria:** All E2E tests pass. Full flow works locally.

---

## Phase 5: Hardening & Deploy

**Goal:** Security hardening, production deployment.

**Streams:** 2 (parallel, then merge for final deploy)

### Stream 5A: Security Hardening

**Scope:**

1. **Security headers** (CloudFront Function or Lambda@Edge)
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.sealed.fyi; frame-ancestors 'none'
   Referrer-Policy: no-referrer
   X-Content-Type-Options: nosniff
   X-Frame-Options: DENY
   Cache-Control: no-store
   Strict-Transport-Security: max-age=31536000; includeSubDomains
   ```

2. **Security audit checklist:**
   - [ ] Keys never in server logs
   - [ ] URL fragment never sent to server
   - [ ] No inline scripts in HTML
   - [ ] No third-party scripts
   - [ ] Rate limiting configured
   - [ ] PoW difficulty appropriate
   - [ ] Token TTL enforced
   - [ ] DynamoDB TTL enabled
   - [ ] Uniform error responses verified

3. **Documentation:**
   - `docs/THREAT_MODEL.md` — finalize threat model

### Stream 5B: Production Infrastructure

**Scope:**

1. **CloudFront distribution** for frontend
2. **S3 bucket** for static assets
3. **Custom domain** setup (sealed.fyi)
4. **SSL certificate** (ACM)
5. **Production SAM deployment**
6. **Monitoring/alerting** (CloudWatch)

**Deployment script:** `scripts/deploy.sh`

**Exit Criteria:** Application deployed to production, accessible at sealed.fyi, all security headers verified.

---

## Summary: Phases and Parallelism

| Phase | Streams | Can Parallelize? | Depends On |
|-------|---------|------------------|------------|
| 1: Contracts | 1A | No | — |
| 2: Libraries | 2A, 2B | **Yes** | Phase 1 |
| 3: Backend/Frontend | 3A, 3B | **Yes** | Phase 1, 2 |
| 4: Integration | 4A | No | Phase 3 |
| 5: Hardening/Deploy | 5A, 5B | **Yes** | Phase 4 |

---

## Agent Assignment

| Phase | Stream | Agent | Description |
|-------|--------|-------|-------------|
| 1 | 1A | Agent A | Define all contracts |
| 2 | 2A | Agent B | Crypto library |
| 2 | 2B | Agent C | PoW library |
| 3 | 3A | Agent D | Backend + Infra |
| 3 | 3B | Agent E | Frontend UI |
| 4 | 4A | Agent F | Integration |
| 5 | 5A | Agent G | Security hardening |
| 5 | 5B | Agent H | Production deploy |

**Maximum parallel agents:** 2 (in Phases 2, 3, 5)