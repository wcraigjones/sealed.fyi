'use strict';

const {
  generateChallenge,
  verifyPow,
  _internal
} = require('./pow');

const { sha256, countLeadingZeroBits, solvePow } = _internal;

describe('pow.js', () => {
  describe('generateChallenge', () => {
    it('should return default challenge with default parameters', () => {
      const challenge = generateChallenge();
      
      expect(challenge).toEqual({
        difficulty: 18,
        prefix: 'sealed:'
      });
    });

    it('should accept custom difficulty', () => {
      const challenge = generateChallenge(20);
      
      expect(challenge.difficulty).toBe(20);
      expect(challenge.prefix).toBe('sealed:');
    });

    it('should accept custom prefix', () => {
      const challenge = generateChallenge(18, 'custom:');
      
      expect(challenge.difficulty).toBe(18);
      expect(challenge.prefix).toBe('custom:');
    });
  });

  describe('sha256', () => {
    it('should produce correct hash for known input', () => {
      // SHA256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
      const hash = sha256('hello');
      
      expect(hash.toString('hex')).toBe(
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
      );
    });

    it('should produce 32-byte output', () => {
      const hash = sha256('test input');
      
      expect(hash.length).toBe(32);
    });
  });

  describe('countLeadingZeroBits', () => {
    it('should count zeros correctly for all-zero byte', () => {
      const buffer = Buffer.from([0x00, 0xFF]);
      
      expect(countLeadingZeroBits(buffer)).toBe(8);
    });

    it('should count zeros correctly for multiple zero bytes', () => {
      const buffer = Buffer.from([0x00, 0x00, 0xFF]);
      
      expect(countLeadingZeroBits(buffer)).toBe(16);
    });

    it('should count zeros correctly for partial byte', () => {
      // 0x01 = 00000001 -> 7 leading zeros
      const buffer = Buffer.from([0x01, 0xFF]);
      
      expect(countLeadingZeroBits(buffer)).toBe(7);
    });

    it('should count zeros correctly for 0x0F', () => {
      // 0x0F = 00001111 -> 4 leading zeros
      const buffer = Buffer.from([0x0F, 0xFF]);
      
      expect(countLeadingZeroBits(buffer)).toBe(4);
    });

    it('should return 0 for buffer starting with high bit set', () => {
      // 0x80 = 10000000 -> 0 leading zeros
      const buffer = Buffer.from([0x80, 0x00]);
      
      expect(countLeadingZeroBits(buffer)).toBe(0);
    });

    it('should handle empty buffer', () => {
      const buffer = Buffer.from([]);
      
      expect(countLeadingZeroBits(buffer)).toBe(0);
    });
  });

  describe('verifyPow', () => {
    const challenge = { difficulty: 8, prefix: 'test:' };
    const nonce = 'abc123';

    it('should accept valid solution', () => {
      // Find a valid solution for testing
      const solution = solvePow(nonce, challenge, 1000000);
      expect(solution).not.toBeNull();
      
      const result = verifyPow(nonce, solution, challenge);
      expect(result).toBe(true);
    });

    it('should reject invalid solution', () => {
      // This solution almost certainly won't have 8 leading zero bits
      const result = verifyPow(nonce, 'definitely-not-valid', challenge);
      
      expect(result).toBe(false);
    });

    it('should return false for invalid inputs', () => {
      expect(verifyPow(null, '123', challenge)).toBe(false);
      expect(verifyPow(nonce, null, challenge)).toBe(false);
      expect(verifyPow(nonce, '123', null)).toBe(false);
      expect(verifyPow(nonce, '123', {})).toBe(false);
      expect(verifyPow(nonce, '123', { difficulty: 'not-number', prefix: 'test:' })).toBe(false);
      expect(verifyPow(nonce, '123', { difficulty: 8 })).toBe(false);
    });

    it('should return false for non-string nonce', () => {
      expect(verifyPow(123, '123', challenge)).toBe(false);
      expect(verifyPow({}, '123', challenge)).toBe(false);
    });

    it('should return false for non-string solution', () => {
      expect(verifyPow(nonce, 123, challenge)).toBe(false);
      expect(verifyPow(nonce, {}, challenge)).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(verifyPow('', '123', challenge)).toBe(false);
      expect(verifyPow(nonce, '', challenge)).toBe(false);
    });
  });

  describe('solvePow', () => {
    it('should find a valid solution for low difficulty', () => {
      const challenge = { difficulty: 8, prefix: 'test:' };
      const nonce = 'test-nonce-123';
      
      const solution = solvePow(nonce, challenge, 1000000);
      
      expect(solution).not.toBeNull();
      expect(verifyPow(nonce, solution, challenge)).toBe(true);
    });

    it('should return null if no solution found within attempts', () => {
      // Use impossibly high difficulty
      const challenge = { difficulty: 256, prefix: 'test:' };
      const nonce = 'test-nonce';
      
      const solution = solvePow(nonce, challenge, 100);
      
      expect(solution).toBeNull();
    });
  });

  describe('integration', () => {
    it('should work with realistic parameters', () => {
      // Use slightly lower difficulty for faster test
      const challenge = generateChallenge(12);
      const nonce = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
      
      const solution = solvePow(nonce, challenge, 10000000);
      expect(solution).not.toBeNull();
      
      expect(verifyPow(nonce, solution, challenge)).toBe(true);
    });

    it('should reject solution with different nonce', () => {
      const challenge = generateChallenge(8);
      const nonce1 = 'nonce1';
      const nonce2 = 'nonce2';
      
      const solution = solvePow(nonce1, challenge, 1000000);
      expect(solution).not.toBeNull();
      
      // Solution for nonce1 should not work with nonce2
      expect(verifyPow(nonce2, solution, challenge)).toBe(false);
    });

    it('should reject solution with different prefix', () => {
      const challenge1 = { difficulty: 8, prefix: 'prefix1:' };
      const challenge2 = { difficulty: 8, prefix: 'prefix2:' };
      const nonce = 'test-nonce';
      
      const solution = solvePow(nonce, challenge1, 1000000);
      expect(solution).not.toBeNull();
      
      // Solution for challenge1 should not work with challenge2
      expect(verifyPow(nonce, solution, challenge2)).toBe(false);
    });
  });
});
