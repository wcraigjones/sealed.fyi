# Phase 2, Stream B: Proof-of-Work Library

## Goal
Implement the client-side proof-of-work library for anti-abuse.

## Files
- `frontend/js/pow.js`
- `frontend/js/pow.test.js`

## Scope
- SHA-256 hashcash-style PoW
- Solve challenge (find solution where SHA256(prefix + nonce + solution) has N leading zero bits)
- Verify solution
- Optional: Web Worker wrapper for non-blocking solve

## Functions to Implement

```javascript
// Solve a PoW challenge
async function solveChallenge(nonce: string, challenge: PowChallenge): Promise<string>

// Verify a PoW solution (for testing; server does real verification)
function verifyChallenge(nonce: string, solution: string, challenge: PowChallenge): boolean

// Types
interface PowChallenge {
  difficulty: number  // Number of leading zero bits required
  prefix: string      // e.g., "sealed:"
}
```

## Algorithm
1. Concatenate: `prefix + nonce + counter`
2. Hash with SHA-256
3. Check if hash has `difficulty` leading zero bits
4. If not, increment counter and repeat
5. Return counter as solution

## Tests Required
- Solve produces valid solution
- Verify accepts valid solution
- Verify rejects invalid solution
- Difficulty scaling works correctly
- Performance benchmarks for different difficulty levels

## Dependencies
- None (uses browser Web Crypto API for SHA-256)

## Exit Criteria
- [ ] All functions implemented
- [ ] All tests passing
- [ ] Difficulty 18 solves in < 5 seconds on average hardware
- [ ] Code reviewed
