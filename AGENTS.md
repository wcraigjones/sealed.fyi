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
│   ├── agents/               # OB1 review agents (subagents with specific models)
│   │   ├── opus-review.md    # Claude Opus 4.5 reviewer
│   │   ├── gemini-review.md  # Gemini 3 Pro reviewer (1M context)
│   │   ├── codex-review.md   # OpenAI Codex 5.2 reviewer
│   │   ├── glm-review.md     # Z.AI GLM 4.7 reviewer
│   │   └── kimi-review.md    # Moonshot Kimi K2.5 reviewer
│   │
│   └── skills/               # OB1 local skills (legacy CLI-based review)
│       ├── claude-review/    # Claude CLI review
│       ├── codex-review/     # Codex CLI review
│       ├── gemini-review/    # Gemini CLI review
│       └── mega-review/      # All 3 CLIs in parallel
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

## Available Review Agents

The project includes 5 review agents that run as OB1 subagents. Each agent writes a review file to the work item folder.

| Agent | Model | Output File |
|-------|-------|-------------|
| `opus-review` | Claude Opus 4.5 | `{work_path}/opus-review.md` |
| `gemini-review` | Gemini 3 Pro (1M context) | `{work_path}/gemini-review.md` |
| `codex-review` | OpenAI Codex 5.2 | `{work_path}/codex-review.md` |
| `glm-review` | Z.AI GLM 4.7 | `{work_path}/glm-review.md` |
| `kimi-review` | Moonshot Kimi K2.5 | `{work_path}/kimi-review.md` |

### Review Agent Behavior

- Each agent reads the task requirements from `TASK.md`
- Each agent checks for previous reviews and addresses whether issues were resolved
- Each agent writes a structured review with a **Quality Score (1-10)**
- Reviews contain only **substantial feedback** — no nits or style preferences
- Approval status: **APPROVED** (score ≥ 7) or **NEEDS WORK** (score < 7)

---

## Agent Workflow

**Every agent must follow this workflow:**

### 1. Task Assignment
- Agents must be assigned to a **specific task** (e.g., "Phase 2, Stream A" or "2A")
- Read the task file at `docs/work/{phase}/{stream}/TASK.md` before starting
- Do not work on tasks outside your assignment without explicit approval

### 2. During Work
- Follow the scope and requirements in the task file
- Check off exit criteria as you complete them
- If blocked or scope changes, update the task file to reflect current state

### 3. Multi-Model Review (REQUIRED)

After completing implementation, you **MUST** run all 5 review agents:

```
delegate_to_agent(agent_name="opus-review", work_path="docs/work/{phase}/{stream}")
delegate_to_agent(agent_name="gemini-review", work_path="docs/work/{phase}/{stream}")
delegate_to_agent(agent_name="codex-review", work_path="docs/work/{phase}/{stream}")
delegate_to_agent(agent_name="glm-review", work_path="docs/work/{phase}/{stream}")
delegate_to_agent(agent_name="kimi-review", work_path="docs/work/{phase}/{stream}")
```

Each agent will write a review file to the work folder:
- `docs/work/{phase}/{stream}/opus-review.md`
- `docs/work/{phase}/{stream}/gemini-review.md`
- `docs/work/{phase}/{stream}/codex-review.md`
- `docs/work/{phase}/{stream}/glm-review.md`
- `docs/work/{phase}/{stream}/kimi-review.md`

### 4. Respond to Reviews

After all reviews complete:

1. **Read all 5 review files**
2. **Check scores** — ALL agents must give a score of **7 or higher** for the task to be complete
3. **If any score < 7:**
   - Address the critical issues and warnings raised
   - Re-run the review agents that gave low scores
   - Repeat until all scores ≥ 7
4. **If all scores ≥ 7:**
   - Proceed to update the task file

### 5. Update Task File and Project Status

- **Always update `docs/work/{phase}/{stream}/TASK.md` before returning to the user**
- Mark completed exit criteria with `[x]`
- Add review scores summary
- If task is complete, add a `## Completed` section with summary and date

- **Always update `STATUS.md` at the project root:**
  - Update the task status (⏳ Pending → 🔄 In Progress → ✅ Complete)
  - Add an entry to the "Recent Updates" section with date and summary
  - Update the phase progress count (e.g., "2/10" → "3/10")

### Example Task File Update
```markdown
## Exit Criteria

- [x] All functions implemented
- [x] All tests passing
- [x] All review agents scored ≥ 7
- [ ] Awaiting integration testing (Phase 3)

## Review Scores

| Agent | Score | Status |
|-------|-------|--------|
| opus-review | 8/10 | APPROVED |
| gemini-review | 7/10 | APPROVED |
| codex-review | 8/10 | APPROVED |
| glm-review | 7/10 | APPROVED |
| kimi-review | 8/10 | APPROVED |

## Completed
- **Date:** 2026-01-30
- **Summary:** Implemented crypto.js with all functions per contract. All 5 review agents approved.
- **Notes:** Consider adding Web Worker support for PoW in future iteration.
```

### Review Iteration Example

If initial reviews return mixed scores:

```
opus-review:  8/10 APPROVED
gemini-review: 6/10 NEEDS WORK (missing input validation)
codex-review: 7/10 APPROVED
glm-review:   5/10 NEEDS WORK (error handling incomplete)
kimi-review:  7/10 APPROVED
```

You must:
1. Fix the input validation issue flagged by gemini-review
2. Fix the error handling issue flagged by glm-review
3. Re-run `gemini-review` and `glm-review`
4. Continue until both return ≥ 7

---

## Key Invariants

These must be maintained throughout development:

1. **Server cannot read secrets** — encryption happens client-side
2. **Keys never leave the browser** — stored in URL fragment only
3. **No auto-fetch on page load** — explicit "Reveal" click required
4. **Uniform error responses** — missing/expired/consumed are indistinguishable
5. **Minimal metadata** — no PII, short log retention
6. **Expiry enforced on read** — don't rely solely on DynamoDB TTL
