# Phase 3, Stream A: Wire Frontend to Backend

## Goal
Connect the frontend to the real backend and verify end-to-end flows.

## Scope
- Connect `api.js` to local SAM endpoint
- Connect `app.js` to real crypto.js and pow.js
- Verify create flow end-to-end
- Verify reveal flow end-to-end
- Fix integration bugs

## Prerequisites
- Phase 2 complete
- All components working in isolation
- SAM local API running
- DynamoDB Local running

## Integration Tasks

### 1. Configure API Endpoint
Update `api.js` to point to local SAM:
```javascript
const API_BASE = 'http://localhost:3000'  // SAM local default
```

### 2. Verify Create Flow
1. Fill in secret form
2. Click create
3. Verify token request works
4. Verify PoW completes
5. Verify encryption works
6. Verify secret submission works
7. Verify URL generation includes correct fragment
8. Verify secret stored in DynamoDB

### 3. Verify Reveal Flow
1. Open generated URL
2. Verify secret ID parsed from URL
3. Click "Reveal"
4. Verify API fetch works
5. Verify decryption works
6. Verify secret displays correctly
7. Verify remainingViews decremented

### 4. Verify Passphrase Flow
1. Create secret with passphrase
2. Open URL
3. Enter passphrase
4. Verify decryption works with correct passphrase
5. Verify decryption fails with wrong passphrase

### 5. Verify Burn Flow
1. Create secret
2. Use burn URL/token
3. Verify secret deleted
4. Verify retrieve returns 404

### 6. Bug Fixes
- Document and fix any integration issues
- Ensure error handling works end-to-end

## Testing Checklist
- [ ] Create simple secret → retrieve → content matches
- [ ] Create with maxViews=2 → retrieve twice → third fails
- [ ] Create with passphrase → retrieve with passphrase
- [ ] Create → burn → retrieve fails
- [ ] Create with short TTL → wait → retrieve fails
- [ ] Error states display correctly
- [ ] Loading states display correctly

## Exit Criteria
- [ ] All flows work end-to-end
- [ ] No console errors
- [ ] No network errors
- [ ] All integration bugs documented and fixed
- [ ] Code reviewed
