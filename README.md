# sealed.fyi

A privacy-first, single-page web application for creating and sharing secrets with minimal trust and maximum ephemerality.

## Purpose

sealed.fyi addresses the unsafe persistence and overexposure of sensitive information when shared via conventional messaging, email, or document systems. It is a narrowly scoped tool for transient, high-sensitivity information exchange—not a general-purpose storage product.

### Project Status

This project is in the **planning and design phase**. The documentation describes the target architecture and implementation plan. See [ARCHITECTURE.md](ARCHITECTURE.md) for the phased implementation roadmap.

### Design Principles

- **Ephemeral by default** — secrets do not persist indefinitely
- **Server-blind** — the server cannot read secrets
- **Identity-free** — no accounts or tracking required
- **Abuse-resistant without compromising privacy**
- **Simple enough for one-off use**

### Design Filter

Every feature is evaluated against one question:

> Does this increase the amount of time, data, or trust required beyond what is strictly necessary?

If yes, it should be reconsidered.

---

## User Flows

### Secret Creation

1. User enters a secret (text, bounded size)
2. Client requests a short-lived, anonymous authorization token from the server
3. Client encrypts the secret entirely in-browser (keys never leave the client)
4. Client completes proof-of-work bound to the request
5. Client submits ciphertext + metadata; server validates token, nonce, and PoW
6. Client generates retrieval URL with decryption key in the fragment (never sent to server)
7. User shares the link out-of-band

### Secret Retrieval

1. Recipient opens the link (no login or token required)
2. Client fetches encrypted data from server
3. Client decrypts entirely in-browser
4. Server immediately destroys the secret (or decrements view count)
5. Clear confirmation shown to recipient

---

## Secret Lifecycle

```
Created → Stored (encrypted, opaque) → Retrieved → Destroyed
```

**Guarantees:**
- Server cannot decrypt secrets at any point
- Secrets are not recoverable after destruction
- Destruction is irreversible and server-enforced
- Expiration is enforced on read (immediate) and via TTL cleanup (eventual)
- Metadata is minimized and bounded by retention policies

---

## Settings

### Secret-Level Settings (per-secret, set at creation)

| Setting | Options | Default | Notes |
|---------|---------|---------|-------|
| **TTL** | 15 min, 1 hr, 1 day, 7 days, 30 days, 90 days | 1 day | Mandatory; secret deleted on expiry |
| **Max Views** | 1–5 | 1 | Consumed on successful fetch |
| **Passphrase** | Optional | Off | Additional client-side KDF; never transmitted |
| **Burn Link** | Optional | Off | Creator receives a separate burn URL to delete the secret early |

**Expiration Behavior:**
- Secret becomes unretrievable immediately (enforced on read via expiry timestamp check)
- Ciphertext deleted via DynamoDB TTL (best-effort cleanup, typically within 48 hours)
- Server returns neutral "not available" response (no oracle signals)

**Access Policy:**
- Default is single-use (1 view)
- Short idempotency window (5–30 sec) tolerates refresh/prefetch
- Explicit "Reveal" click required—no auto-fetch on page load (anti-bot)

### Client/Session Settings (local storage, UX only)

- Default TTL preset (remembers last choice)
- Default max views (remembers last choice)
- Default passphrase toggle (remembers last choice)
- Auto-copy link on create (opt-in)
- Auto-hide secret after N seconds (optional)

### System Policy Settings (server-enforced, not user-editable)

**Authorization & Anti-Abuse:**
- Token TTL: ~5 minutes
- Single-use nonce per token
- Token binds to operation type and PoW challenge
- Proof-of-work with adaptive difficulty under load
- Coarse rate limiting (minimal data retention)

**Payload Constraints:**
- Max plaintext size: 50 KB (text only initially)
- Max ciphertext size: ~68 KB (base64 encoding adds ~33% overhead)
- UTF-8, preserve whitespace exactly

**Response Uniformity (Anti-Oracle):**
- Missing, expired, and consumed secrets return identical 404 responses
- Same HTTP status, same response shape, same timing profile
- UI messages are helpful but not state-revealing

**Metadata Minimization:**
- Stored per secret: creation time, expiry time, remaining views, ciphertext length
- Not stored: user agent, referrer, plaintext-derived signals
- Expired secrets cleaned up via DynamoDB TTL (best-effort, typically within 48 hours)
- Application-level expiry check on read ensures immediate enforcement
- Logs minimal and short-lived

---

## Threat Model

### Assumptions

- Client browser is trusted at runtime
- TLS is uncompromised
- Users share links via reasonably secure channels

### Explicit Non-Assumptions

- Server is **not** trusted with plaintext
- Administrators **cannot** read secrets
- Logs may be inspected → logs must not contain sensitive material

### Attack Mitigations

| Threat | Mitigation |
|--------|------------|
| Mass abuse | Proof-of-work + short-lived tokens |
| Replay attacks | Nonce-bound tokens |
| Link guessing | High-entropy identifiers |
| Passive surveillance | Encryption before transmission |
| Preview bots | Require explicit "Reveal" click |
| Brute-force probing | Rate limiting on reads |

---

## Security Controls

### Browser Security (Critical for SPA)

- **Content Security Policy**: Extremely strict; no third-party scripts, no inline scripts (or nonce-required)
- **Referrer-Policy**: `no-referrer` (prevents leaking secret path)
- **Cache-Control**: `no-store` on retrieval (reduces local traces)
- **Link Prefetch**: Disabled where possible

### Cryptographic Invariants

- Decryption keys **never** reach the server (URL fragment only)
- All server-stored fields must be safe to disclose (assume breach)
- Secret retrieval does **not** happen automatically on page load

---

## Non-Goals

Explicitly out of scope:

- User accounts or authentication
- Long-term secret storage
- Search, indexing, or discovery
- Monetization via advertising
- Collaboration or shared editing
- Rich media secrets (files/images)

---

## Architecture

- **Frontend**: Vanilla JavaScript SPA (no framework, all crypto client-side)
- **Backend**: AWS Lambda functions
- **Storage**: AWS DynamoDB (TTL-based auto-expiration)
- **Infrastructure**: AWS SAM/CloudFormation

### Project Structure

```
sealed.fyi/
├── README.md
├── LICENSE
│
├── frontend/
│   ├── index.html              # Single page; views as hidden sections
│   ├── css/
│   │   └── style.css           # Minimal, clean styling
│   └── js/
│       ├── app.js              # View routing, UI logic, state management
│       ├── crypto.js           # Encryption/decryption (Web Crypto API)
│       ├── api.js              # Server communication
│       ├── pow.js              # Proof-of-work implementation
│       └── storage.js          # Local storage for client preferences
│
├── backend/
│   ├── template.yaml           # SAM/CloudFormation template
│   ├── samconfig.toml          # SAM deployment configuration
│   └── functions/
│       ├── create-token/       # Issue short-lived authorization tokens
│       │   ├── index.js
│       │   └── package.json
│       ├── create-secret/      # Validate token/PoW, store ciphertext
│       │   ├── index.js
│       │   └── package.json
│       ├── get-secret/         # Fetch and consume/decrement secret
│       │   ├── index.js
│       │   └── package.json
│       ├── burn-secret/        # Optional early deletion by creator
│       │   ├── index.js
│       │   └── package.json
│       └── shared/             # Shared utilities
│           ├── dynamo.js       # DynamoDB client helpers
│           ├── token.js        # Token generation/validation
│           ├── pow.js          # PoW verification
│           └── responses.js    # Uniform response formatting
│
├── infrastructure/
│   ├── dynamodb-table.yaml     # DynamoDB table definition (if separate)
│   └── cloudfront.yaml         # CDN configuration for frontend
│
├── scripts/
│   ├── local-setup.sh          # Start local DynamoDB + SAM
│   └── deploy.sh               # Production deployment
│
└── docs/
    ├── THREAT_MODEL.md         # Detailed threat model and mitigations
    ├── CRYPTO.md               # Cryptographic design decisions
    └── API.md                  # API endpoint documentation
```

### SPA Constraints

- All cryptographic operations occur client-side (Web Crypto API)
- Navigation is state-based (show/hide DOM sections), not route-based
- No frameworks, no third-party scripts with DOM access
- No build step required
- Fewer moving parts = reduced audit complexity

---

## Local Development

Run the full stack locally using AWS SAM CLI for Lambda emulation and DynamoDB Local.

```bash
# Prerequisites: AWS SAM CLI, Docker, Node.js

# Start local DynamoDB
docker run -p 8000:8000 amazon/dynamodb-local

# Start SAM local API
sam local start-api

# Serve frontend (no build step required - static files only)
cd frontend && npx serve .
# Or use any static file server: python -m http.server 3000
```

---

## License

MIT