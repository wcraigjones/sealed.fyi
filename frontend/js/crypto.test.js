/**
 * sealed.fyi Crypto Library Tests
 * 
 * Tests for client-side encryption using Web Crypto API.
 * Run with Node.js 20+ (which has global crypto).
 */

const {
  generateKey,
  encrypt,
  decrypt,
  deriveKeyFromPassphrase,
  generateSalt,
  keyToBase64Url,
  base64UrlToKey,
  encryptSecret,
  decryptSecret,
  bytesToBase64,
  base64ToBytes,
  bytesToBase64Url,
  base64UrlToBytes,
  AES_KEY_LENGTH,
  IV_LENGTH,
  SALT_LENGTH,
  PBKDF2_ITERATIONS
} = require('./crypto.js');

const assert = require('assert');

// Test results tracking
let passed = 0;
let failed = 0;
const failures = [];

/**
 * Simple test runner
 */
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed++;
    failures.push({ name, error });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('sealed.fyi Crypto Library Tests\n');
  console.log('================================\n');

  // ============ UTILITY TESTS ============

  console.log('Utility Functions\n');

  await test('bytesToBase64/base64ToBytes round-trip', async () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64]);
    const base64 = bytesToBase64(original);
    const decoded = base64ToBytes(base64);
    assert.deepStrictEqual(decoded, original);
  });

  await test('bytesToBase64Url/base64UrlToBytes round-trip', async () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64, 63, 62]);
    const base64url = bytesToBase64Url(original);
    const decoded = base64UrlToBytes(base64url);
    assert.deepStrictEqual(decoded, original);
  });

  await test('base64url encoding is URL-safe', async () => {
    // Create bytes that would produce + and / in standard base64
    const bytes = new Uint8Array([255, 254, 253, 252, 251, 250]);
    const base64url = bytesToBase64Url(bytes);
    assert.ok(!base64url.includes('+'), 'Should not contain +');
    assert.ok(!base64url.includes('/'), 'Should not contain /');
    assert.ok(!base64url.includes('='), 'Should not contain padding');
  });

  // ============ KEY GENERATION TESTS ============

  console.log('\nKey Generation\n');

  await test('generateKey creates a 256-bit AES key', async () => {
    const key = await generateKey();
    assert.strictEqual(key.algorithm.name, 'AES-GCM');
    assert.strictEqual(key.algorithm.length, 256);
    assert.ok(key.extractable);
    assert.deepStrictEqual(key.usages.sort(), ['decrypt', 'encrypt']);
  });

  await test('generateKey creates unique keys', async () => {
    const key1 = await generateKey();
    const key2 = await generateKey();
    const raw1 = await crypto.subtle.exportKey('raw', key1);
    const raw2 = await crypto.subtle.exportKey('raw', key2);
    assert.notDeepStrictEqual(new Uint8Array(raw1), new Uint8Array(raw2));
  });

  // ============ ENCRYPTION/DECRYPTION TESTS ============

  console.log('\nEncryption/Decryption\n');

  await test('encrypt/decrypt round-trip with simple text', async () => {
    const plaintext = 'Hello, World!';
    const key = await generateKey();
    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, iv, key);
    assert.strictEqual(decrypted, plaintext);
  });

  await test('encrypt/decrypt round-trip with Unicode', async () => {
    const plaintext = '🔐 Secret message with émojis and ñ characters 日本語';
    const key = await generateKey();
    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, iv, key);
    assert.strictEqual(decrypted, plaintext);
  });

  await test('encrypt/decrypt round-trip with empty string', async () => {
    const plaintext = '';
    const key = await generateKey();
    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, iv, key);
    assert.strictEqual(decrypted, plaintext);
  });

  await test('encrypt/decrypt round-trip with large text', async () => {
    const plaintext = 'A'.repeat(50000); // 50KB
    const key = await generateKey();
    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, iv, key);
    assert.strictEqual(decrypted, plaintext);
  });

  await test('encrypt/decrypt round-trip preserves whitespace', async () => {
    const plaintext = '  leading\n\ttabs\r\nCRLF  trailing  ';
    const key = await generateKey();
    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, iv, key);
    assert.strictEqual(decrypted, plaintext);
  });

  await test('encrypt generates unique IV each time', async () => {
    const plaintext = 'Same plaintext';
    const key = await generateKey();
    const result1 = await encrypt(plaintext, key);
    const result2 = await encrypt(plaintext, key);
    assert.notStrictEqual(result1.iv, result2.iv);
  });

  await test('decryption fails with wrong key', async () => {
    const plaintext = 'Secret message';
    const key1 = await generateKey();
    const key2 = await generateKey();
    const { ciphertext, iv } = await encrypt(plaintext, key1);
    
    try {
      await decrypt(ciphertext, iv, key2);
      assert.fail('Should have thrown an error');
    } catch (error) {
      // Expected: decryption with wrong key should fail
      assert.ok(error.message.includes('decrypt') || error.name === 'OperationError');
    }
  });

  await test('decryption fails with tampered ciphertext', async () => {
    const plaintext = 'Secret message';
    const key = await generateKey();
    const { ciphertext, iv } = await encrypt(plaintext, key);
    
    // Tamper with ciphertext
    const bytes = base64ToBytes(ciphertext);
    bytes[0] ^= 0xFF; // Flip bits
    const tamperedCiphertext = bytesToBase64(bytes);
    
    try {
      await decrypt(tamperedCiphertext, iv, key);
      assert.fail('Should have thrown an error');
    } catch (error) {
      // Expected: GCM authentication should fail
      assert.ok(error.message.includes('decrypt') || error.name === 'OperationError');
    }
  });

  await test('decryption fails with tampered IV', async () => {
    const plaintext = 'Secret message';
    const key = await generateKey();
    const { ciphertext, iv } = await encrypt(plaintext, key);
    
    // Tamper with IV
    const bytes = base64ToBytes(iv);
    bytes[0] ^= 0xFF;
    const tamperedIv = bytesToBase64(bytes);
    
    try {
      await decrypt(ciphertext, tamperedIv, key);
      assert.fail('Should have thrown an error');
    } catch (error) {
      // Expected: decryption with wrong IV should fail
      assert.ok(error.message.includes('decrypt') || error.name === 'OperationError');
    }
  });

  // ============ PASSPHRASE DERIVATION TESTS ============

  console.log('\nPassphrase Key Derivation\n');

  await test('deriveKeyFromPassphrase is deterministic', async () => {
    const passphrase = 'my-secret-passphrase';
    const salt = generateSalt();
    
    const key1 = await deriveKeyFromPassphrase(passphrase, salt);
    const key2 = await deriveKeyFromPassphrase(passphrase, salt);
    
    const raw1 = await crypto.subtle.exportKey('raw', key1);
    const raw2 = await crypto.subtle.exportKey('raw', key2);
    
    assert.deepStrictEqual(new Uint8Array(raw1), new Uint8Array(raw2));
  });

  await test('different passphrases produce different keys', async () => {
    const salt = generateSalt();
    
    const key1 = await deriveKeyFromPassphrase('passphrase1', salt);
    const key2 = await deriveKeyFromPassphrase('passphrase2', salt);
    
    const raw1 = await crypto.subtle.exportKey('raw', key1);
    const raw2 = await crypto.subtle.exportKey('raw', key2);
    
    assert.notDeepStrictEqual(new Uint8Array(raw1), new Uint8Array(raw2));
  });

  await test('different salts produce different keys', async () => {
    const passphrase = 'same-passphrase';
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    
    const key1 = await deriveKeyFromPassphrase(passphrase, salt1);
    const key2 = await deriveKeyFromPassphrase(passphrase, salt2);
    
    const raw1 = await crypto.subtle.exportKey('raw', key1);
    const raw2 = await crypto.subtle.exportKey('raw', key2);
    
    assert.notDeepStrictEqual(new Uint8Array(raw1), new Uint8Array(raw2));
  });

  await test('derived key can encrypt/decrypt', async () => {
    const passphrase = 'test-passphrase';
    const salt = generateSalt();
    const plaintext = 'Message encrypted with derived key';
    
    const key = await deriveKeyFromPassphrase(passphrase, salt);
    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, iv, key);
    
    assert.strictEqual(decrypted, plaintext);
  });

  // ============ SALT GENERATION TESTS ============

  console.log('\nSalt Generation\n');

  await test('generateSalt creates 16-byte salt', async () => {
    const salt = generateSalt();
    const bytes = base64ToBytes(salt);
    assert.strictEqual(bytes.length, 16);
  });

  await test('generateSalt creates unique salts', async () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    assert.notStrictEqual(salt1, salt2);
  });

  // ============ KEY ENCODING TESTS ============

  console.log('\nKey Encoding (URL Fragment)\n');

  await test('keyToBase64Url/base64UrlToKey round-trip', async () => {
    const key = await generateKey();
    const encoded = await keyToBase64Url(key);
    const decoded = await base64UrlToKey(encoded);
    
    const raw1 = await crypto.subtle.exportKey('raw', key);
    const raw2 = await crypto.subtle.exportKey('raw', decoded);
    
    assert.deepStrictEqual(new Uint8Array(raw1), new Uint8Array(raw2));
  });

  await test('keyToBase64Url produces URL-safe output', async () => {
    // Generate multiple keys to increase chance of hitting special chars
    for (let i = 0; i < 10; i++) {
      const key = await generateKey();
      const encoded = await keyToBase64Url(key);
      
      assert.ok(!encoded.includes('+'), 'Should not contain +');
      assert.ok(!encoded.includes('/'), 'Should not contain /');
      assert.ok(!encoded.includes('='), 'Should not contain padding');
    }
  });

  await test('keyToBase64Url produces 43-char output (256-bit key)', async () => {
    const key = await generateKey();
    const encoded = await keyToBase64Url(key);
    // 32 bytes = 256 bits, base64url encoded = ~43 chars
    assert.strictEqual(encoded.length, 43);
  });

  await test('decoded key can encrypt/decrypt', async () => {
    const originalKey = await generateKey();
    const encoded = await keyToBase64Url(originalKey);
    const decodedKey = await base64UrlToKey(encoded);
    
    const plaintext = 'Test with decoded key';
    const { ciphertext, iv } = await encrypt(plaintext, originalKey);
    const decrypted = await decrypt(ciphertext, iv, decodedKey);
    
    assert.strictEqual(decrypted, plaintext);
  });

  // ============ HIGH-LEVEL API TESTS ============

  console.log('\nHigh-Level API\n');

  await test('encryptSecret/decryptSecret round-trip (no passphrase)', async () => {
    const plaintext = 'My secret message';
    
    const { payload, urlFragment } = await encryptSecret(plaintext);
    
    assert.ok(payload.ciphertext);
    assert.ok(payload.iv);
    assert.strictEqual(payload.salt, null);
    assert.ok(urlFragment);
    
    const decrypted = await decryptSecret(payload, urlFragment);
    assert.strictEqual(decrypted, plaintext);
  });

  await test('encryptSecret/decryptSecret round-trip (with passphrase)', async () => {
    const plaintext = 'My passphrase-protected secret';
    const passphrase = 'super-secret-phrase';
    
    const { payload, urlFragment } = await encryptSecret(plaintext, passphrase);
    
    assert.ok(payload.ciphertext);
    assert.ok(payload.iv);
    assert.ok(payload.salt); // Salt should be present
    assert.ok(urlFragment);
    
    const decrypted = await decryptSecret(payload, urlFragment, passphrase);
    assert.strictEqual(decrypted, plaintext);
  });

  await test('decryptSecret fails with wrong passphrase', async () => {
    const plaintext = 'Protected secret';
    const passphrase = 'correct-passphrase';
    const wrongPassphrase = 'wrong-passphrase';
    
    const { payload, urlFragment } = await encryptSecret(plaintext, passphrase);
    
    try {
      await decryptSecret(payload, urlFragment, wrongPassphrase);
      assert.fail('Should have thrown an error');
    } catch (error) {
      // Expected: decryption with wrong passphrase should fail
      assert.ok(error);
    }
  });

  await test('decryptSecret throws when passphrase required but not provided', async () => {
    const plaintext = 'Protected secret';
    const passphrase = 'my-passphrase';
    
    const { payload, urlFragment } = await encryptSecret(plaintext, passphrase);
    
    try {
      await decryptSecret(payload, urlFragment); // No passphrase provided
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.strictEqual(error.message, 'Passphrase required for this secret');
    }
  });

  await test('encryptSecret with passphrase produces larger URL fragment', async () => {
    const plaintext = 'Test message';
    
    const { urlFragment: noPassFragment } = await encryptSecret(plaintext);
    const { urlFragment: withPassFragment } = await encryptSecret(plaintext, 'passphrase');
    
    // With passphrase: fragment = wrappingIV (12) + wrappedKey (32) + authTag (16) = 60 bytes
    // Without passphrase: fragment = key (32 bytes)
    assert.ok(withPassFragment.length > noPassFragment.length);
  });

  await test('encryptSecret generates unique outputs each time', async () => {
    const plaintext = 'Same message';
    
    const result1 = await encryptSecret(plaintext);
    const result2 = await encryptSecret(plaintext);
    
    // Different IVs should produce different ciphertexts
    assert.notStrictEqual(result1.payload.ciphertext, result2.payload.ciphertext);
    assert.notStrictEqual(result1.payload.iv, result2.payload.iv);
    // Different keys
    assert.notStrictEqual(result1.urlFragment, result2.urlFragment);
  });

  await test('encryptSecret with passphrase generates unique salts', async () => {
    const plaintext = 'Same message';
    const passphrase = 'same-passphrase';
    
    const result1 = await encryptSecret(plaintext, passphrase);
    const result2 = await encryptSecret(plaintext, passphrase);
    
    assert.notStrictEqual(result1.payload.salt, result2.payload.salt);
  });

  await test('encryptSecret/decryptSecret with Unicode and passphrase', async () => {
    const plaintext = '🔐 Ключ到秘密 émoji ñ';
    const passphrase = 'пароль密码contraseña';
    
    const { payload, urlFragment } = await encryptSecret(plaintext, passphrase);
    const decrypted = await decryptSecret(payload, urlFragment, passphrase);
    
    assert.strictEqual(decrypted, plaintext);
  });

  await test('decryptSecret fails with wrong URL fragment (no passphrase)', async () => {
    const plaintext = 'Secret';
    
    const { payload } = await encryptSecret(plaintext);
    const { urlFragment: wrongFragment } = await encryptSecret('Other');
    
    try {
      await decryptSecret(payload, wrongFragment);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error);
    }
  });

  await test('decryptSecret fails with wrong URL fragment (with passphrase)', async () => {
    const plaintext = 'Secret';
    const passphrase = 'test';
    
    const { payload } = await encryptSecret(plaintext, passphrase);
    const { urlFragment: wrongFragment } = await encryptSecret('Other', passphrase);
    
    try {
      await decryptSecret(payload, wrongFragment, passphrase);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error);
    }
  });

  // ============ SUMMARY ============

  console.log('\n================================');
  console.log(`\nTests: ${passed + failed} total`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(({ name, error }) => {
      console.log(`\n  ${name}:`);
      console.log(`    ${error.stack || error.message}`);
    });
    process.exit(1);
  }
  
  console.log('\n✓ All tests passed!\n');
}

// Run tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});