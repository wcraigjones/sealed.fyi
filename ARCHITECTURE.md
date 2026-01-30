# Architecture & Parallel Work Streams

This document breaks down the sealed.fyi implementation into parallelizable work streams with clearly defined contracts and dependencies.

---

## Work Stream Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WORK STREAMS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │   Stream 1   │   │   Stream 2   │   │   Stream 3   │   │   Stream 4   │ │
│  │   Frontend   │   │   Backend    │   │   Crypto     │   │   Infra      │ │
│  │   UI/UX      │   │   Lambdas    │   │   Library    │   │   & DevOps   │ │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘ │
│         │                  │                  │                  │         │
│         └──────────────────┴────────┬─────────┴──────────────────┘         │
│                                     │                                       │
│                            ┌────────▼────────┐                              │
│                            │    Stream 5     │                              │
│                            │   Integration   │                              │
│                            │    & Testing    │                              │
│                            └─────────────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Stream 1: Frontend UI/UX

**Owner:** Frontend developer  
**Dependencies:** Crypto Library (Stream 3) contracts, API contracts (Stream 2)  
**Can start immediately:** Yes (mock API and crypto)

### Scope

- `frontend/index.html` — semantic HTML structure with view sections
- `frontend/css/style.css` — clean, minimal styling
- `frontend/js/app.js` — view routing, form handling, state management
- `frontend/js/storage.js` — local storage for preferences

### Deliverables

1. **Create View** — secret input, TTL selector, max views selector, passphrase toggle, submit button
2. **Link View** — display generated link, copy button, warnings
3. **Reveal View** — "Click to reveal" button, passphrase input (if required), secret display
4. **Status Views** — loading, error, expired/consumed states
5. **Preference Persistence** — remember last TTL, max views, passphrase toggle

### Contracts Required

```typescript
// From Stream 3 (Crypto Library)
interface CryptoLib {
  generateKey(): Promise<CryptoKey>
  encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedPayload>
  decrypt(payload: EncryptedPayload, key: CryptoKey): Promise<string>
  deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey>
  keyToUrlFragment(key: CryptoKey): Promise<string>
  urlFragmentToKey(fragment: string): Promise<CryptoKey>
}

// From Stream 2 (API)
interface ApiClient {
  getToken(): Promise<TokenResponse>
  createSecret(request: CreateSecretRequest): Promise<CreateSecretResponse>
  getSecret(id: string): Promise<GetSecretResponse>
  burnSecret(id: string, burnToken: string): Promise<void>
}
```

### Mocking Strategy

- Mock `crypto.js` with fake encrypt/decrypt that base64 encodes
- Mock `api.js` with localStorage-backed fake backend
- Allows full UI development without real backend

---

## Stream 2: Backend Lambda Functions

**Owner:** Backend developer  
**Dependencies:** DynamoDB table exists (Stream 4), PoW verification logic (shared with Stream 3)  
**Can start immediately:** Yes (local DynamoDB)

### Scope

- `backend/functions/create-token/` — issue authorization tokens
- `backend/functions/create-secret/` — validate and store ciphertext
- `backend/functions/get-secret/` — fetch and consume secrets
- `backend/functions/burn-secret/` — early deletion by creator
- `backend/functions/shared/` — common utilities

### Deliverables

#### Lambda: `create-token`

```
POST /token

Response:
{
  "token": "jwt...",
  "nonce": "abc123",
  "powChallenge": {
    "difficulty": 18,
    "prefix": "sealed:"
  },
  "expiresAt": 1234567890
}
```

#### Lambda: `create-secret`

```
POST /secrets
Headers: Authorization: Bearer <token>

Request:
{
  "ciphertext": "base64...",
  "nonce": "abc123",
  "pow": "solution...",
  "ttl": 86400,
  "maxViews": 1,
  "passphraseProtected": false
}

Response:
{
  "id": "high-entropy-id",
  "burnToken": "optional-burn-token",
  "expiresAt": 1234567890
}
```

#### Lambda: `get-secret`

```
GET /secrets/{id}

Response (success):
{
  "ciphertext": "base64...",
  "passphraseProtected": false,
  "remainingViews": 0
}

Response (consumed/expired/missing — IDENTICAL):
{
  "error": "not_available"
}
```

#### Lambda: `burn-secret`

```
DELETE /secrets/{id}
Headers: X-Burn-Token: <burn-token>

Response: 204 No Content (always, even if already gone)
```

### Shared Utilities

```javascript
// backend/functions/shared/dynamo.js
export async function getSecret(id): Promise<Secret | null>
export async function putSecret(secret: Secret): Promise<void>
export async function deleteSecret(id): Promise<void>
export async function decrementViews(id): Promise<number>

// backend/functions/shared/token.js
export function generateToken(nonce: string, powChallenge: Challenge): string
export function validateToken(token: string): TokenPayload | null

// backend/functions/shared/pow.js
export function generateChallenge(): Challenge
export function verifyPow(nonce: string, solution: string, difficulty: number): boolean

// backend/functions/shared/responses.js
export function success(body: object): APIGatewayResponse
export function notAvailable(): APIGatewayResponse  // uniform 404
export function badRequest(message: string): APIGatewayResponse
```

### Anti-Oracle Invariant

All of these return **identical** responses:
- Secret doesn't exist
- Secret expired
- Secret consumed
- Invalid ID format

---

## Stream 3: Crypto Library

**Owner:** Security-focused developer  
**Dependencies:** None  
**Can start immediately:** Yes

### Scope

- `frontend/js/crypto.js` — client-side encryption/decryption
- `frontend/js/pow.js` — proof-of-work implementation
- Documentation in `docs/CRYPTO.md`

### Deliverables

#### Encryption Module (`crypto.js`)

```javascript
// Key generation
async function generateKey(): CryptoKey

// Encryption (AES-256-GCM)
async function encrypt(plaintext: string, key: CryptoKey): EncryptedPayload
// Returns: { ciphertext: Uint8Array, iv: Uint8Array }

// Decryption
async function decrypt(payload: EncryptedPayload, key: CryptoKey): string

// Passphrase derivation (PBKDF2)
async function deriveKeyFromPassphrase(
  passphrase: string, 
  salt: Uint8Array
): CryptoKey

// URL fragment encoding (base64url)
async function keyToUrlFragment(key: CryptoKey): string
async function urlFragmentToKey(fragment: string): CryptoKey

// Combined encryption with optional passphrase
async function encryptSecret(
  plaintext: string,
  passphrase?: string
): { payload: EncryptedPayload, urlFragment: string, salt?: Uint8Array }

// Combined decryption with optional passphrase
async function decryptSecret(
  payload: EncryptedPayload,
  urlFragment: string,
  passphrase?: string,
  salt?: Uint8Array
): string
```

#### Proof-of-Work Module (`pow.js`)

```javascript
// Solve a PoW challenge (runs in main thread or Web Worker)
async function solveChallenge(
  nonce: string,
  difficulty: number,
  prefix: string
): string

// Verify a solution (for testing; server does real verification)
function verifySolution(
  nonce: string,
  solution: string,
  difficulty: number,
  prefix: string
): boolean
```

### Cryptographic Choices

| Purpose | Algorithm | Notes |
|---------|-----------|-------|
| Symmetric encryption | AES-256-GCM | Authenticated encryption |
| Key derivation (passphrase) | PBKDF2-SHA256 | 100,000+ iterations |
| Random key generation | `crypto.getRandomValues()` | 256 bits |
| Proof-of-work | SHA-256 leading zeros | Hashcash-style |

### Testing Requirements

- Unit tests for encrypt/decrypt round-trip
- Unit tests for passphrase derivation determinism
- Unit tests for URL fragment encoding round-trip
- PoW solution verification tests
- Test vectors for interoperability

---

## Stream 4: Infrastructure & DevOps

**Owner:** DevOps/Platform engineer  
**Dependencies:** None  
**Can start immediately:** Yes

### Scope

- `backend/template.yaml` — SAM template
- `infrastructure/` — additional CloudFormation
- `scripts/` — local dev and deployment scripts
- CI/CD pipeline configuration

### Deliverables

#### SAM Template (`backend/template.yaml`)

```yaml
Resources:
  # DynamoDB Table
  SecretsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: sealed-secrets
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      BillingMode: PAY_PER_REQUEST
      TimeToLiveSpecification:
        AttributeName: expiresAt
        Enabled: true

  # API Gateway
  ApiGateway:
    Type: AWS::Serverless::HttpApi
    Properties:
      CorsConfiguration:
        AllowOrigins: ["https://sealed.fyi"]
        AllowMethods: ["GET", "POST", "DELETE", "OPTIONS"]
        AllowHeaders: ["Authorization", "Content-Type", "X-Burn-Token"]

  # Lambda Functions (one per endpoint)
  CreateTokenFunction:
    Type: AWS::Serverless::Function
    # ...

  # CloudFront Distribution
  # S3 Bucket for Frontend
  # Security Headers Lambda@Edge
```

#### DynamoDB Schema

```
Table: sealed-secrets

Primary Key: id (String, high-entropy)

Attributes:
  - id: string              # URL-safe, 22+ chars
  - ciphertext: binary      # Encrypted payload
  - iv: binary              # Initialization vector
  - salt: binary            # For passphrase-protected secrets (optional)
  - passphraseProtected: boolean
  - remainingViews: number
  - burnToken: string       # For creator deletion (optional)
  - createdAt: number       # Unix timestamp
  - expiresAt: number       # Unix timestamp (TTL attribute)
```

#### Security Headers (Lambda@Edge or CloudFront Function)

```javascript
// Response headers for all frontend requests
{
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.sealed.fyi; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store, max-age=0",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
}
```

#### Local Development Scripts

```bash
# scripts/local-setup.sh
#!/bin/bash
# Start DynamoDB Local
docker run -d -p 8000:8000 --name dynamodb-local amazon/dynamodb-local

# Create table
aws dynamodb create-table 
  --endpoint-url http://localhost:8000 
  --table-name sealed-secrets 
  --attribute-definitions AttributeName=id,AttributeType=S 
  --key-schema AttributeName=id,KeyType=HASH 
  --billing-mode PAY_PER_REQUEST

# Start SAM local
sam local start-api --docker-network host
```

---

## Stream 5: Integration & Testing

**Owner:** QA/Integration engineer  
**Dependencies:** All other streams (starts after initial deliverables)  
**Can start:** After Streams 1-4 have basic implementations

### Scope

- End-to-end integration testing
- Security testing
- Performance testing
- Documentation finalization

### Deliverables

#### Integration Tests

```javascript
// Full flow tests
describe('Secret Lifecycle', () => {
  test('create and retrieve secret (single view)')
  test('create and retrieve secret (multiple views)')
  test('secret expires after TTL')
  test('secret with passphrase')
  test('burn secret before retrieval')
  test('attempt to retrieve consumed secret')
  test('attempt to retrieve expired secret')
  test('attempt to retrieve non-existent secret')
  // All three above should be indistinguishable
})

describe('Anti-Abuse', () => {
  test('token expires after TTL')
  test('token cannot be reused')
  test('invalid PoW rejected')
  test('rate limiting enforced')
})

describe('Security Headers', () => {
  test('CSP headers present')
  test('no-referrer policy')
  test('no-store cache control')
})
```

#### Security Testing Checklist

- [ ] Key material never appears in server logs
- [ ] URL fragment not sent to server (verify via request inspection)
- [ ] Responses for missing/expired/consumed are byte-identical
- [ ] No timing side-channels in secret lookup
- [ ] CSP blocks inline scripts and external sources
- [ ] PoW prevents bulk creation

#### Documentation

- `docs/THREAT_MODEL.md` — detailed threat model
- `docs/CRYPTO.md` — cryptographic design rationale
- `docs/API.md` — API endpoint documentation

---

## Dependency Graph

```
Stream 3 (Crypto)     Stream 4 (Infra)
     │                     │
     │ contracts           │ DynamoDB schema
     ▼                     ▼
Stream 1 (Frontend)   Stream 2 (Backend)
     │                     │
     │                     │
     └──────────┬──────────┘
                │
                ▼
        Stream 5 (Integration)
```

### Critical Path

1. **Crypto contracts** must be defined first (Stream 3 priority)
2. **API contracts** must be defined first (Stream 2 priority)
3. **DynamoDB schema** must be finalized early (Stream 4 priority)
4. Streams 1, 2, 3, 4 can then proceed in parallel
5. Stream 5 begins once others have testable implementations

---

## Contract Freeze Points

To enable parallel development, these contracts must be frozen early:

### Week 1 Freeze: Interfaces

1. **Crypto Library Interface** — function signatures, data types
2. **API Endpoints** — paths, methods, request/response shapes
3. **DynamoDB Schema** — table structure, attribute names

### Week 2 Freeze: Behavior

1. **Error Response Shapes** — uniform error handling
2. **Security Header Set** — CSP, referrer policy, etc.
3. **PoW Parameters** — difficulty, challenge format

---

## Communication Channels

| Stream | Publishes | Consumes |
|--------|-----------|----------|
| Frontend | UI event hooks | Crypto API, Backend API |
| Backend | REST API | DynamoDB, Token/PoW utils |
| Crypto | JS module API | None |
| Infra | Deployed resources | SAM template |
| Integration | Test results, bugs | All of the above |

---

## Parallel Execution Timeline

```
Week 1:
  All: Define and freeze contracts
  Stream 3: Implement crypto.js, pow.js
  Stream 4: Set up DynamoDB, SAM template
  Stream 1: Build UI with mocks
  Stream 2: Implement Lambdas with local DynamoDB

Week 2:
  Stream 1: Connect to real crypto library
  Stream 2: Finalize Lambda implementations
  Stream 3: Unit tests, documentation
  Stream 4: CloudFront, security headers, deployment scripts
  Stream 5: Begin integration testing

Week 3:
  Stream 5: Full E2E testing
  All: Bug fixes, polish
  Stream 4: Production deployment
```

---

## Agent Assignment Recommendations

For AI agent parallelization:

| Agent | Stream | Focus |
|-------|--------|-------|
| Agent A | Stream 3 | Crypto library (isolated, no dependencies) |
| Agent B | Stream 4 | Infrastructure (isolated, no dependencies) |
| Agent C | Stream 1 | Frontend UI (can mock dependencies) |
| Agent D | Stream 2 | Backend Lambdas (can use local DynamoDB) |
| Agent E | Stream 5 | Integration (joins after initial implementations) |

**Coordination points:**
- Shared contract definitions in `docs/API.md` and `docs/CRYPTO.md`
- Agents check in contracts before implementation
- Integration agent validates contract compliance
