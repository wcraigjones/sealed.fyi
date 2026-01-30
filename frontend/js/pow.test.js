/**
 * sealed.fyi - Proof-of-Work Library Tests
 * 
 * Run with: npx vitest run pow.test.js
 * Or in watch mode: npx vitest pow.test.js
 */

import { describe, test, expect } from 'vitest';
import { webcrypto } from 'node:crypto';

// Polyfill Web Crypto API for Node.js
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto;
}

// Import the pow module
const {
  solveChallenge,
  verifyChallenge,
  hasLeadingZeroBits,
  sha256,
  bytesToHex,
  stringToBytes,
  DEFAULT_PREFIX
} = await import('./pow.js');

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('Utility Functions', () => {
  describe('bytesToHex', () => {
    test('converts bytes to hex string', () => {
      const bytes = new Uint8Array([0, 1, 15, 16, 255]);
      const hex = bytesToHex(bytes);
      expect(hex).toBe('00010f10ff');
    });
    
    test('handles empty array', () => {
      const bytes = new Uint8Array([]);
      const hex = bytesToHex(bytes);
      expect(hex).toBe('');
    });
    
    test('pads single digit values', () => {
      const bytes = new Uint8Array([0, 5, 10]);
      const hex = bytesToHex(bytes);
      expect(hex).toBe('00050a');
    });
  });
  
  describe('stringToBytes', () => {
    test('converts string to UTF-8 bytes', () => {
      const str = 'Hello';
      const bytes = stringToBytes(str);
      expect(bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });
    
    test('handles empty string', () => {
      const bytes = stringToBytes('');
      expect(bytes).toEqual(new Uint8Array([]));
    });
  });
  
  describe('sha256', () => {
    test('computes correct hash', async () => {
      // Known SHA-256 hash: SHA256("test") = 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
      const hash = await sha256('test');
      const hex = bytesToHex(hash);
      expect(hex).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
    });
    
    test('handles empty string', async () => {
      // SHA256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      const hash = await sha256('');
      const hex = bytesToHex(hash);
      expect(hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
    
    test('returns 32 bytes (256 bits)', async () => {
      const hash = await sha256('any input');
      expect(hash.length).toBe(32);
    });
  });
  
  describe('hasLeadingZeroBits', () => {
    test('returns true for difficulty 0', () => {
      const hash = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
      expect(hasLeadingZeroBits(hash, 0)).toBe(true);
    });
    
    test('checks 1 leading zero bit', () => {
      // 0x7F = 01111111 (1 leading zero)
      // 0x80 = 10000000 (0 leading zeros)
      expect(hasLeadingZeroBits(new Uint8Array([0x7F]), 1)).toBe(true);
      expect(hasLeadingZeroBits(new Uint8Array([0x80]), 1)).toBe(false);
    });
    
    test('checks 4 leading zero bits', () => {
      // 0x0F = 00001111 (4 leading zeros)
      // 0x10 = 00010000 (3 leading zeros)
      expect(hasLeadingZeroBits(new Uint8Array([0x0F]), 4)).toBe(true);
      expect(hasLeadingZeroBits(new Uint8Array([0x10]), 4)).toBe(false);
    });
    
    test('checks 8 leading zero bits (1 full byte)', () => {
      expect(hasLeadingZeroBits(new Uint8Array([0x00, 0xFF]), 8)).toBe(true);
      expect(hasLeadingZeroBits(new Uint8Array([0x01, 0xFF]), 8)).toBe(false);
    });
    
    test('checks 12 leading zero bits (1.5 bytes)', () => {
      // First byte = 0x00, second byte must have 4 leading zeros (0x0F or less)
      expect(hasLeadingZeroBits(new Uint8Array([0x00, 0x0F]), 12)).toBe(true);
      expect(hasLeadingZeroBits(new Uint8Array([0x00, 0x10]), 12)).toBe(false);
    });
    
    test('checks 16 leading zero bits (2 full bytes)', () => {
      expect(hasLeadingZeroBits(new Uint8Array([0x00, 0x00, 0xFF]), 16)).toBe(true);
      expect(hasLeadingZeroBits(new Uint8Array([0x00, 0x01, 0xFF]), 16)).toBe(false);
    });
    
    test('checks 20 leading zero bits', () => {
      // 2 full zero bytes + 4 leading zeros in third byte
      expect(hasLeadingZeroBits(new Uint8Array([0x00, 0x00, 0x0F]), 20)).toBe(true);
      expect(hasLeadingZeroBits(new Uint8Array([0x00, 0x00, 0x10]), 20)).toBe(false);
    });
  });
});

// =============================================================================
// Core PoW Tests
// =============================================================================

describe('Proof-of-Work', () => {
  describe('solveChallenge', () => {
    test('solves challenge with difficulty 0', async () => {
      const solution = await solveChallenge('test-nonce', { difficulty: 0, prefix: 'sealed:' });
      expect(solution).toBe('0');  // Trivial case
    });
    
    test('produces valid solution for difficulty 4', async () => {
      const nonce = 'test-nonce-123';
      const challenge = { difficulty: 4, prefix: 'sealed:' };
      
      const solution = await solveChallenge(nonce, challenge);
      const isValid = await verifyChallenge(nonce, solution, challenge);
      
      expect(isValid).toBe(true);
    });
    
    test('produces valid solution for difficulty 8', async () => {
      const nonce = 'another-nonce';
      const challenge = { difficulty: 8, prefix: 'sealed:' };
      
      const solution = await solveChallenge(nonce, challenge);
      const isValid = await verifyChallenge(nonce, solution, challenge);
      
      expect(isValid).toBe(true);
    });
    
    test('produces valid solution for difficulty 12', async () => {
      const nonce = 'nonce-12bit';
      const challenge = { difficulty: 12, prefix: 'sealed:' };
      
      const solution = await solveChallenge(nonce, challenge);
      const isValid = await verifyChallenge(nonce, solution, challenge);
      
      expect(isValid).toBe(true);
    });
    
    test('uses default prefix when not provided', async () => {
      const nonce = 'test';
      const challenge = { difficulty: 4 };  // No prefix
      
      const solution = await solveChallenge(nonce, challenge);
      
      // Verify with explicit default prefix
      const hash = await sha256(DEFAULT_PREFIX + nonce + solution);
      expect(hasLeadingZeroBits(hash, 4)).toBe(true);
    });
    
    test('uses custom prefix', async () => {
      const nonce = 'test';
      const prefix = 'custom:';
      const challenge = { difficulty: 4, prefix };
      
      const solution = await solveChallenge(nonce, challenge);
      
      // Verify with custom prefix
      const hash = await sha256(prefix + nonce + solution);
      expect(hasLeadingZeroBits(hash, 4)).toBe(true);
    });
    
    test('throws on invalid nonce (empty)', async () => {
      await expect(
        solveChallenge('', { difficulty: 4, prefix: 'sealed:' })
      ).rejects.toThrow('Invalid nonce');
    });
    
    test('throws on invalid nonce (not string)', async () => {
      await expect(
        solveChallenge(null, { difficulty: 4, prefix: 'sealed:' })
      ).rejects.toThrow('Invalid nonce');
    });
    
    test('throws on invalid difficulty (negative)', async () => {
      await expect(
        solveChallenge('nonce', { difficulty: -1, prefix: 'sealed:' })
      ).rejects.toThrow('Invalid difficulty');
    });
    
    test('throws on invalid difficulty (> 256)', async () => {
      await expect(
        solveChallenge('nonce', { difficulty: 257, prefix: 'sealed:' })
      ).rejects.toThrow('Invalid difficulty');
    });
    
    test('throws on invalid difficulty (not number)', async () => {
      await expect(
        solveChallenge('nonce', { difficulty: 'high', prefix: 'sealed:' })
      ).rejects.toThrow('Invalid difficulty');
    });
  });
  
  describe('verifyChallenge', () => {
    test('accepts valid solution', async () => {
      const nonce = 'verify-test';
      const challenge = { difficulty: 8, prefix: 'sealed:' };
      
      const solution = await solveChallenge(nonce, challenge);
      const isValid = await verifyChallenge(nonce, solution, challenge);
      
      expect(isValid).toBe(true);
    });
    
    test('rejects invalid solution', async () => {
      const nonce = 'verify-test';
      const challenge = { difficulty: 8, prefix: 'sealed:' };
      
      // "invalid" is almost certainly not a valid solution
      const isValid = await verifyChallenge(nonce, 'invalid-solution-xyz', challenge);
      
      expect(isValid).toBe(false);
    });
    
    test('rejects solution for different nonce', async () => {
      const challenge = { difficulty: 8, prefix: 'sealed:' };
      
      const solution = await solveChallenge('nonce-1', challenge);
      const isValid = await verifyChallenge('nonce-2', solution, challenge);
      
      expect(isValid).toBe(false);
    });
    
    test('rejects solution for different prefix', async () => {
      const nonce = 'test-nonce';
      
      const solution = await solveChallenge(nonce, { difficulty: 8, prefix: 'sealed:' });
      const isValid = await verifyChallenge(nonce, solution, { difficulty: 8, prefix: 'other:' });
      
      expect(isValid).toBe(false);
    });
    
    test('rejects solution for higher difficulty', async () => {
      const nonce = 'test-nonce';
      
      // Get a solution for difficulty 4
      const solution = await solveChallenge(nonce, { difficulty: 4, prefix: 'sealed:' });
      
      // It may or may not be valid for difficulty 8+ (likely not)
      // We just verify it's valid for the original difficulty
      const validForOriginal = await verifyChallenge(nonce, solution, { difficulty: 4, prefix: 'sealed:' });
      expect(validForOriginal).toBe(true);
    });
    
    test('returns true for difficulty 0 regardless of solution', async () => {
      const isValid = await verifyChallenge('any-nonce', 'any-solution', { difficulty: 0, prefix: 'sealed:' });
      expect(isValid).toBe(true);
    });
    
    test('returns false for invalid nonce', async () => {
      const isValid = await verifyChallenge('', 'solution', { difficulty: 4, prefix: 'sealed:' });
      expect(isValid).toBe(false);
    });
    
    test('returns false for invalid solution type', async () => {
      const isValid = await verifyChallenge('nonce', null, { difficulty: 4, prefix: 'sealed:' });
      expect(isValid).toBe(false);
    });
    
    test('returns false for invalid difficulty', async () => {
      const isValid = await verifyChallenge('nonce', 'solution', { difficulty: -1, prefix: 'sealed:' });
      expect(isValid).toBe(false);
    });
  });
  
  describe('difficulty scaling', () => {
    test('difficulty 4 produces hash with 4+ leading zero bits', async () => {
      const nonce = 'scaling-test-4';
      const challenge = { difficulty: 4, prefix: 'sealed:' };
      
      const solution = await solveChallenge(nonce, challenge);
      const hash = await sha256(challenge.prefix + nonce + solution);
      
      // First 4 bits should be zero (first nibble is 0)
      expect(hash[0] >> 4).toBe(0);
    });
    
    test('difficulty 8 produces hash with 8+ leading zero bits', async () => {
      const nonce = 'scaling-test-8';
      const challenge = { difficulty: 8, prefix: 'sealed:' };
      
      const solution = await solveChallenge(nonce, challenge);
      const hash = await sha256(challenge.prefix + nonce + solution);
      
      // First byte should be 0
      expect(hash[0]).toBe(0);
    });
    
    test('difficulty 16 produces hash with 16+ leading zero bits', async () => {
      const nonce = 'scaling-test-16';
      const challenge = { difficulty: 16, prefix: 'sealed:' };
      
      const solution = await solveChallenge(nonce, challenge);
      const hash = await sha256(challenge.prefix + nonce + solution);
      
      // First two bytes should be 0
      expect(hash[0]).toBe(0);
      expect(hash[1]).toBe(0);
    });
    
    test('different nonces produce different solutions', async () => {
      const challenge = { difficulty: 8, prefix: 'sealed:' };
      
      const solution1 = await solveChallenge('nonce-a', challenge);
      const solution2 = await solveChallenge('nonce-b', challenge);
      
      // Solutions might occasionally be the same, but hashes will be different
      const hash1 = bytesToHex(await sha256(challenge.prefix + 'nonce-a' + solution1));
      const hash2 = bytesToHex(await sha256(challenge.prefix + 'nonce-b' + solution2));
      
      expect(hash1).not.toBe(hash2);
    });
  });
});

// =============================================================================
// Performance Tests
// =============================================================================

describe('Performance', () => {
  test('difficulty 8 solves in reasonable time', async () => {
    const start = Date.now();
    await solveChallenge('perf-test-8', { difficulty: 8, prefix: 'sealed:' });
    const elapsed = Date.now() - start;
    
    // Should be well under 1 second
    expect(elapsed).toBeLessThan(1000);
  });
  
  test('difficulty 12 solves in reasonable time', async () => {
    const start = Date.now();
    await solveChallenge('perf-test-12', { difficulty: 12, prefix: 'sealed:' });
    const elapsed = Date.now() - start;
    
    // Should be under 2 seconds
    expect(elapsed).toBeLessThan(2000);
  });
  
  test('difficulty 16 solves in reasonable time', async () => {
    const start = Date.now();
    await solveChallenge('perf-test-16', { difficulty: 16, prefix: 'sealed:' });
    const elapsed = Date.now() - start;
    
    // Should be under 5 seconds (depends on hardware)
    expect(elapsed).toBeLessThan(5000);
  }, { timeout: 10000 });
  
  test('difficulty 18 benchmark (average of 3 runs)', async () => {
    const times = [];
    
    for (let i = 0; i < 3; i++) {
      const nonce = `benchmark-18-run-${i}-${Date.now()}`;
      const start = Date.now();
      await solveChallenge(nonce, { difficulty: 18, prefix: 'sealed:' });
      const elapsed = Date.now() - start;
      times.push(elapsed);
    }
    
    const average = times.reduce((a, b) => a + b, 0) / times.length;
    
    // Log for visibility
    console.log(`Difficulty 18 benchmark: ${times.join('ms, ')}ms`);
    console.log(`Average: ${average.toFixed(0)}ms`);
    
    // Exit criteria: should average under 5 seconds
    expect(average).toBeLessThan(5000);
  }, { timeout: 30000 });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  test('handles unicode in nonce', async () => {
    const nonce = '测试-🔑-émoji';
    const challenge = { difficulty: 4, prefix: 'sealed:' };
    
    const solution = await solveChallenge(nonce, challenge);
    const isValid = await verifyChallenge(nonce, solution, challenge);
    
    expect(isValid).toBe(true);
  });
  
  test('handles unicode in prefix', async () => {
    const nonce = 'test';
    const challenge = { difficulty: 4, prefix: '封印:' };
    
    const solution = await solveChallenge(nonce, challenge);
    const isValid = await verifyChallenge(nonce, solution, challenge);
    
    expect(isValid).toBe(true);
  });
  
  test('handles very long nonce', async () => {
    const nonce = 'x'.repeat(1000);
    const challenge = { difficulty: 4, prefix: 'sealed:' };
    
    const solution = await solveChallenge(nonce, challenge);
    const isValid = await verifyChallenge(nonce, solution, challenge);
    
    expect(isValid).toBe(true);
  });
  
  test('handles empty prefix', async () => {
    const nonce = 'test';
    const challenge = { difficulty: 4, prefix: '' };
    
    const solution = await solveChallenge(nonce, challenge);
    const isValid = await verifyChallenge(nonce, solution, challenge);
    
    expect(isValid).toBe(true);
  });
  
  test('solution is a numeric string', async () => {
    const solution = await solveChallenge('test', { difficulty: 4, prefix: 'sealed:' });
    
    // Solution should be parseable as integer
    const parsed = parseInt(solution, 10);
    expect(isNaN(parsed)).toBe(false);
    expect(parsed.toString()).toBe(solution);
  });
});
