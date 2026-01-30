# Phase 2, Stream I: Frontend JavaScript Application

## Goal
Implement the main application logic, API client, and storage module.

## Files
- `frontend/js/app.js`
- `frontend/js/api.js`
- `frontend/js/storage.js`

## Modules

### app.js — Main Application Logic

**View Routing:**
```javascript
function showView(viewId)  // Hide all views, show specified view
function hideAllViews()
function getCurrentView()
```

**State Management:**
```javascript
const state = {
  currentView: 'create',
  secret: null,
  secretId: null,
  burnToken: null,
  urlFragment: null,
  error: null
}
```

**Create Flow:**
```javascript
async function handleCreate(event)
// 1. Get form values (secret, ttl, maxViews, passphrase)
// 2. Show creating view
// 3. Get token from API
// 4. Solve PoW
// 5. Encrypt secret (with passphrase if provided)
// 6. Submit to API
// 7. Generate full URL with fragment
// 8. Show link view
```

**Reveal Flow:**
```javascript
async function handleReveal()
// 1. Parse URL fragment for key
// 2. Get secret from API
// 3. If passphrase required, show passphrase view
// 4. Decrypt secret
// 5. Show secret view
```

**Event Handlers:**
- Form submit on create view
- Click handlers for buttons
- URL hash change detection

**Initialization:**
```javascript
function init()
// 1. Check URL for secret ID
// 2. If secret ID present, show reveal view
// 3. Otherwise, show create view
// 4. Load preferences from storage
```

### api.js — API Client

```javascript
const API_BASE = '/api'  // Or configured endpoint

async function getToken(): Promise<TokenResponse>
// POST /token

async function createSecret(request: CreateSecretRequest): Promise<CreateSecretResponse>
// POST /secrets with Authorization header

async function getSecret(id: string, accessToken?: string): Promise<GetSecretResponse>
// GET /secrets/{id}?accessToken=...

async function burnSecret(id: string, burnToken: string): Promise<void>
// DELETE /secrets/{id} with X-Burn-Token header

// Error handling wrapper
async function apiRequest(url, options): Promise<any>
// Handles fetch, JSON parsing, error responses
```

### storage.js — LocalStorage Wrapper

```javascript
const STORAGE_KEY = 'sealed_preferences'

function getPreferences(): Preferences
// Returns { ttl, maxViews, usePassphrase } or defaults

function setPreferences(prefs: Partial<Preferences>): void
// Merges with existing preferences

function clearPreferences(): void

// Defaults
const DEFAULT_PREFERENCES = {
  ttl: 86400,      // 1 day
  maxViews: 1,
  usePassphrase: false
}
```

## URL Structure
- Create: `https://sealed.fyi/`
- Reveal: `https://sealed.fyi/#<secretId>:<base64urlKey>`

## Dependencies
- Stream 2A (crypto.js)
- Stream 2B (pow.js)
- Stream 2H (HTML/CSS)

## Error Handling
- Network errors: Show error view with retry option
- API errors: Show appropriate message
- Crypto errors: Show error view
- Invalid URL: Show error view

## Exit Criteria
- [ ] All modules implemented
- [ ] Create flow works with mocked API
- [ ] Reveal flow works with mocked API
- [ ] Preferences persist across sessions
- [ ] Error states handled gracefully
- [ ] Code reviewed
