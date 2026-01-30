# AGENTS.md — sealed.fyi

## Project Overview

**sealed.fyi** is a privacy-first, serverless web application for creating and sharing self-destructing encrypted secrets. The project is currently in the **planning and design phase** — documentation and architecture are complete, but implementation has not yet begun.

### Core Principles
- **Server-blind**: End-to-end encryption; server never sees plaintext
- **Ephemeral**: Secrets auto-expire and are destroyed after viewing
- **Identity-free**: No accounts, no tracking
- **Abuse-resistant**: Proof-of-work and rate limiting without compromising privacy

### Technology Stack
| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JavaScript SPA (no framework) |
| Backend | AWS Lambda (Node.js) |
| Storage | AWS DynamoDB (with TTL) |
| Infrastructure | AWS SAM/CloudFormation |
| CDN | AWS CloudFront |

---

## Project Structure

```
sealed.fyi/
├── README.md                 # Product overview, user flows, settings
├── ARCHITECTURE.md           # Phased implementation plan with parallel work streams
├── AGENTS.md                 # This file
│
├── docs/
│   └── work/                 # Task definitions for each phase/stream
│       ├── 1/a/TASK.md       # Phase 1: Define contracts
│       ├── 2/{a-j}/TASK.md   # Phase 2: Core implementation (10 streams)
│       ├── 3/{a-f}/TASK.md   # Phase 3: Integration & testing (6 streams)
│       └── 4/{a-e}/TASK.md   # Phase 4: Production & hardening (5 streams)
│
├── .ob1/
│   └── skills/               # OB1 local skills for code review
│       ├── claude-review/    # Claude Opus 4 review
│       ├── codex-review/     # Codex GPT-5.2 xhigh review
│       ├── gemini-review/    # Gemini 2.5 Pro review
│       └── mega-review/      # All 3 in parallel, synthesized
│
├── frontend/                 # (To be created)
│   ├── index.html
│   ├── css/style.css
│   └── js/{app,crypto,pow,api,storage}.js
│
├── backend/                  # (To be created)
│   ├── template.yaml
│   └── functions/{create-token,create-secret,get-secret,burn-secret,shared}/
│
├── infrastructure/           # (To be created)
│   └── {cloudfront,s3,monitoring}.yaml
│
├── scripts/                  # (To be created)
│   └── {local-setup,deploy-*}.sh
│
└── tests/                    # (To be created)
    ├── e2e/
    └── security/
```

---

## Implementation Phases

The project is organized into 4 sequential phases. **Phases must complete before the next begins; streams within a phase can run in parallel.**

| Phase | Description | Streams | Max Parallel |
|-------|-------------|---------|--------------|
| **1** | Contracts & Schemas | 1 | 1 |
| **2** | Core Implementation | 10 | 10 |
| **3** | Integration & Testing | 6 | 6 |
| **4** | Production & Hardening | 5 | 5 |

### Phase 1: Contracts (1 stream)
- **1A**: Define API, Crypto, Schema, and Testing contracts in `docs/`

### Phase 2: Core Implementation (10 streams)
- **2A**: Crypto library (`frontend/js/crypto.js`)
- **2B**: PoW library (`frontend/js/pow.js`)
- **2C**: Create Token Lambda
- **2D**: Create Secret Lambda
- **2E**: Get Secret Lambda
- **2F**: Burn Secret Lambda
- **2G**: Shared backend utilities
- **2H**: Frontend HTML/CSS
- **2I**: Frontend JS application
- **2J**: Infrastructure & local dev setup

### Phase 3: Integration & Testing (6 streams)
- **3A**: Wire frontend to backend
- **3B**: E2E test suite
- **3C**: Security test suite
- **3D**: API documentation
- **3E**: Crypto documentation
- **3F**: Threat model documentation

### Phase 4: Production (5 streams)
- **4A**: CloudFront distribution
- **4B**: S3 & domain setup
- **4C**: Security headers
- **4D**: Deployment scripts
- **4E**: Monitoring & alerts

---

## Building and Running

### Prerequisites
- AWS SAM CLI
- Docker
- Node.js 20+

### Local Development (once implemented)
```bash
# Start local DynamoDB
docker run -p 8000:8000 amazon/dynamodb-local

# Start SAM local API
cd backend && sam local start-api

# Serve frontend (static files, no build step)
cd frontend && npx serve .
```

### Deployment (once implemented)
```bash
# Deploy everything
JWT_SECRET=<secret> ./scripts/deploy-all.sh

# Deploy backend only
JWT_SECRET=<secret> ./scripts/deploy-backend.sh

# Deploy frontend only
./scripts/deploy-frontend.sh
```

---

## Development Conventions

### Security Requirements (Non-Negotiable)
- Decryption keys **never** reach the server (URL fragment only)
- All 404 responses must be **identical** (anti-oracle)
- No sensitive data in logs (no IPs, user agents, referrers)
- Strict CSP: no third-party scripts, no inline scripts
- `no-store` cache for HTML and API responses

### Cryptographic Standards
- **Encryption**: AES-256-GCM
- **Key Derivation**: PBKDF2-SHA256 (100,000 iterations)
- **Random Generation**: Web Crypto API / CSPRNG
- **Proof-of-Work**: SHA-256 hashcash-style

### Code Style
- Vanilla JavaScript (no frameworks)
- No build step for frontend
- Node.js 20+ for Lambda functions
- Minimal dependencies

### Testing Requirements
- Unit tests for all crypto functions
- Unit tests for all Lambda functions
- E2E tests for complete flows
- Security tests for anti-oracle and key leakage

---

## Task Files

Each work stream has a detailed task file at `docs/work/{phase}/{stream}/TASK.md` containing:
- Goal and scope
- Files to create/modify
- Function signatures and contracts
- Test requirements
- Exit criteria checklist

**Before starting any stream, read:**
1. `README.md` — Product requirements
2. `ARCHITECTURE.md` — Technical contracts and phase dependencies
3. `docs/work/{phase}/{stream}/TASK.md` — Specific task details

---

## Available Skills

The project includes OB1 skills for multi-model code review:

| Skill | Command | Model |
|-------|---------|-------|
| `claude-review` | `claude -p --model opus --dangerously-skip-permissions` | Claude Opus 4 |
| `codex-review` | `codex exec --model gpt-5.2-codex --config model_reasoning_effort="xhigh" --full-auto` | GPT-5.2 Codex |
| `gemini-review` | `gemini -p --model gemini-2.5-pro --yolo` | Gemini 2.5 Pro |
| `mega-review` | All 3 in parallel | All models |

Use `mega-review` for comprehensive code review with synthesized feedback from all three models.

---

## Key Invariants

These must be maintained throughout development:

1. **Server cannot read secrets** — encryption happens client-side
2. **Keys never leave the browser** — stored in URL fragment only
3. **No auto-fetch on page load** — explicit "Reveal" click required
4. **Uniform error responses** — missing/expired/consumed are indistinguishable
5. **Minimal metadata** — no PII, short log retention
6. **Expiry enforced on read** — don't rely solely on DynamoDB TTL
