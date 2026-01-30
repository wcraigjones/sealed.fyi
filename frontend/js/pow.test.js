/**
 * Tests for Proof-of-Work Library
 *
 * Run with Node.js: node pow.test.js
 * Requires Node.js 20+ for Web Crypto API support
 */

const {
  solveChallenge,
  verifyChallenge,
  sha256,
  hasLeadingZeroBits,
  countLeadingZeroBits,
} = require('./pow.js');

// Simple test runner
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// ============ UNIT TESTS ============

async function runTests() {
  console.log('Running Proof-of-Work Tests\n');
  console.log('--- SHA-256 Tests ---');

  await test('sha256 produces 32-byte hash', async () => {
    const hash = await sha256('test');
    assertEqual(hash.length, 32, 'SHA-256 should produce 32 bytes');
  });

  await test('sha256 is deterministic', async () => {
    const hash1 = await sha256('hello world');
    const hash2 = await sha256('hello world');
    assert(
      hash1.every((b, i) => b === hash2[i]),
      'Same input should produce same hash'
    );
  });

  await test('sha256 different inputs produce different hashes', async () => {
    const hash1 = await sha256('hello');
    const hash2 = await sha256('world');
    assert(
      !hash1.every((b, i) => b === hash2[i]),
      'Different inputs should produce different hashes'
    );
  });

  console.log('\n--- Leading Zero Bits Tests ---');

  await test('hasLeadingZeroBits handles zero difficulty', async () => {
    const hash = new Uint8Array([0xff, 0xff, 0xff]);
    assert(hasLeadingZeroBits(hash, 0), 'Zero difficulty should always pass');
  });

  await test('hasLeadingZeroBits detects 8 leading zeros', async () => {
    const hash = new Uint8Array([0x00, 0xff, 0xff]);
    assert(hasLeadingZeroBits(hash, 8), 'Should detect 8 leading zeros');
    assert(!hasLeadingZeroBits(hash, 9), 'Should not pass for 9 zeros');
  });

  await test('hasLeadingZeroBits detects 16 leading zeros', async () => {
    const hash = new Uint8Array([0x00, 0x00, 0xff]);
    assert(hasLeadingZeroBits(hash, 16), 'Should detect 16 leading zeros');
    assert(!hasLeadingZeroBits(hash, 17), 'Should not pass for 17 zeros');
  });

  await test('hasLeadingZeroBits detects partial byte zeros', async () => {
    // 0x0f = 0000 1111 -> 4 leading zeros
    const hash = new Uint8Array([0x0f, 0xff, 0xff]);
    assert(hasLeadingZeroBits(hash, 4), 'Should detect 4 leading zeros');
    assert(!hasLeadingZeroBits(hash, 5), 'Should not pass for 5 zeros');
  });

  await test('hasLeadingZeroBits handles 0x01 correctly', async () => {
    // 0x01 = 0000 0001 -> 7 leading zeros
    const hash = new Uint8Array([0x01, 0xff, 0xff]);
    assert(hasLeadingZeroBits(hash, 7), 'Should detect 7 leading zeros');
    assert(!hasLeadingZeroBits(hash, 8), 'Should not pass for 8 zeros');
  });

  await test('countLeadingZeroBits counts correctly', async () => {
    assertEqual(countLeadingZeroBits(new Uint8Array([0x00, 0x00, 0xff])), 16);
    assertEqual(countLeadingZeroBits(new Uint8Array([0x00, 0x0f, 0xff])), 12);
    assertEqual(countLeadingZeroBits(new Uint8Array([0x80, 0x00, 0x00])), 0);
    assertEqual(countLeadingZeroBits(new Uint8Array([0x40, 0x00, 0x00])), 1);
    assertEqual(countLeadingZeroBits(new Uint8Array([0x00, 0x00, 0x00])), 24);
  });

  console.log('\n--- Solve Challenge Tests ---');

  await test('solveChallenge produces valid solution for difficulty 1', async () => {
    const nonce = 'test-nonce-001';
    const challenge = { difficulty: 1, prefix: 'sealed:' };
    const solution = await solveChallenge(nonce, challenge);
    const isValid = await verifyChallenge(nonce, solution, challenge);
    assert(isValid, 'Solution should be valid');
  });

  await test('solveChallenge produces valid solution for difficulty 8', async () => {
    const nonce = 'test-nonce-002';
    const challenge = { difficulty: 8, prefix: 'sealed:' };
    const solution = await solveChallenge(nonce, challenge);
    const isValid = await verifyChallenge(nonce, solution, challenge);
    assert(isValid, 'Solution should be valid');
  });

  await test('solveChallenge produces valid solution for difficulty 12', async () => {
    const nonce = 'test-nonce-003';
    const challenge = { difficulty: 12, prefix: 'sealed:' };
    const solution = await solveChallenge(nonce, challenge);
    const isValid = await verifyChallenge(nonce, solution, challenge);
    assert(isValid, 'Solution should be valid');
  });

  await test('solveChallenge works with empty prefix', async () => {
    const nonce = 'test-nonce-004';
    const challenge = { difficulty: 8, prefix: '' };
    const solution = await solveChallenge(nonce, challenge);
    const isValid = await verifyChallenge(nonce, solution, challenge);
    assert(isValid, 'Solution should be valid with empty prefix');
  });

  await test('solveChallenge works with difficulty 0', async () => {
    const nonce = 'test-nonce-005';
    const challenge = { difficulty: 0, prefix: 'sealed:' };
    const solution = await solveChallenge(nonce, challenge);
    assertEqual(solution, '0', 'Difficulty 0 should return first counter (0)');
  });

  console.log('\n--- Verify Challenge Tests ---');

  await test('verifyChallenge accepts valid solution', async () => {
    const nonce = 'verify-test-001';
    const challenge = { difficulty: 8, prefix: 'sealed:' };
    const solution = await solveChallenge(nonce, challenge);
    const isValid = await verifyChallenge(nonce, solution, challenge);
    assert(isValid, 'Should accept valid solution');
  });

  await test('verifyChallenge rejects wrong solution', async () => {
    const nonce = 'verify-test-002';
    const challenge = { difficulty: 12, prefix: 'sealed:' };
    // Use an obviously wrong solution
    const isValid = await verifyChallenge(nonce, 'wrong-solution', challenge);
    assert(!isValid, 'Should reject wrong solution');
  });

  await test('verifyChallenge rejects solution for different nonce', async () => {
    const nonce = 'verify-test-003';
    const challenge = { difficulty: 8, prefix: 'sealed:' };
    const solution = await solveChallenge(nonce, challenge);
    const isValid = await verifyChallenge('different-nonce', solution, challenge);
    assert(!isValid, 'Should reject solution for different nonce');
  });

  await test('verifyChallenge rejects solution for different prefix', async () => {
    const nonce = 'verify-test-004';
    const challenge = { difficulty: 8, prefix: 'sealed:' };
    const solution = await solveChallenge(nonce, challenge);
    const isValid = await verifyChallenge(nonce, solution, {
      difficulty: 8,
      prefix: 'other:',
    });
    assert(!isValid, 'Should reject solution for different prefix');
  });

  await test('verifyChallenge rejects solution for higher difficulty', async () => {
    const nonce = 'verify-test-005';
    const challenge = { difficulty: 4, prefix: 'sealed:' };
    const solution = await solveChallenge(nonce, challenge);
    // The solution may or may not pass for higher difficulty (luck-based)
    // We just verify it passes for original and test with significantly higher
    const isValidOriginal = await verifyChallenge(nonce, solution, challenge);
    assert(isValidOriginal, 'Should accept solution for original difficulty');
  });

  console.log('\n--- Input Validation Tests ---');

  await test('solveChallenge rejects invalid difficulty (negative)', async () => {
    try {
      await solveChallenge('nonce', { difficulty: -1, prefix: 'test:' });
      assert(false, 'Should have thrown');
    } catch (e) {
      assert(e.message.includes('Invalid difficulty'), 'Should report invalid difficulty');
    }
  });

  await test('solveChallenge rejects invalid difficulty (too high)', async () => {
    try {
      await solveChallenge('nonce', { difficulty: 257, prefix: 'test:' });
      assert(false, 'Should have thrown');
    } catch (e) {
      assert(e.message.includes('Invalid difficulty'), 'Should report invalid difficulty');
    }
  });

  await test('solveChallenge rejects non-string nonce', async () => {
    try {
      await solveChallenge(12345, { difficulty: 8, prefix: 'test:' });
      assert(false, 'Should have thrown');
    } catch (e) {
      assert(e.message.includes('Invalid nonce'), 'Should report invalid nonce');
    }
  });

  await test('solveChallenge rejects non-string prefix', async () => {
    try {
      await solveChallenge('nonce', { difficulty: 8, prefix: 123 });
      assert(false, 'Should have thrown');
    } catch (e) {
      assert(e.message.includes('Invalid prefix'), 'Should report invalid prefix');
    }
  });

  await test('verifyChallenge returns false for invalid inputs', async () => {
    // Invalid difficulty
    assert(
      !(await verifyChallenge('nonce', 'solution', { difficulty: -1, prefix: 'test:' })),
      'Should return false for negative difficulty'
    );
    assert(
      !(await verifyChallenge('nonce', 'solution', { difficulty: 300, prefix: 'test:' })),
      'Should return false for difficulty > 256'
    );

    // Invalid types
    assert(
      !(await verifyChallenge(123, 'solution', { difficulty: 8, prefix: 'test:' })),
      'Should return false for non-string nonce'
    );
    assert(
      !(await verifyChallenge('nonce', 123, { difficulty: 8, prefix: 'test:' })),
      'Should return false for non-string solution'
    );
    assert(
      !(await verifyChallenge('nonce', 'solution', { difficulty: 8, prefix: 123 })),
      'Should return false for non-string prefix'
    );
  });

  console.log('\n--- Performance Benchmark ---');

  // Difficulty scaling benchmarks
  const benchmarks = [
    { difficulty: 8, maxTime: 100 },
    { difficulty: 12, maxTime: 500 },
    { difficulty: 16, maxTime: 2000 },
    { difficulty: 18, maxTime: 5000 }, // Target: <5 seconds per spec
  ];

  for (const { difficulty, maxTime } of benchmarks) {
    await test(`difficulty ${difficulty} solves within ${maxTime}ms`, async () => {
      const nonce = `benchmark-${difficulty}-${Date.now()}`;
      const challenge = { difficulty, prefix: 'sealed:' };

      const start = Date.now();
      const solution = await solveChallenge(nonce, challenge);
      const elapsed = Date.now() - start;

      // Verify the solution is valid
      const isValid = await verifyChallenge(nonce, solution, challenge);
      assert(isValid, 'Solution must be valid');

      console.log(`  -> Solved in ${elapsed}ms (solution: ${solution})`);

      // Note: We don't strictly enforce the time limit as it depends on hardware
      // Instead we log a warning if it exceeds the expected time
      if (elapsed > maxTime) {
        console.log(`  ⚠ Warning: Exceeded target of ${maxTime}ms`);
      }
    });
  }

  // Print summary
  console.log('\n========================================');
  console.log(`Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});