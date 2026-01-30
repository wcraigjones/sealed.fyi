# Phase 3, Stream E: Crypto Documentation

## Goal
Create comprehensive cryptographic design documentation.

## Files
- `docs/CRYPTO.md`

## Content

### Overview
- Client-side encryption only
- Server never sees plaintext
- URL fragment for key transport

### Algorithms

#### Symmetric Encryption
- Algorithm: AES-256-GCM
- Key size: 256 bits
- IV size: 96 bits (12 bytes)
- Authentication tag: 128 bits
- Why GCM: Authenticated encryption, standard, hardware acceleration

#### Key Derivation (Passphrase)
- Algorithm: PBKDF2-SHA256
- Iterations: 100,000
- Salt size: 128 bits (16 bytes)
- Output: 256-bit key
- Why PBKDF2: Browser support, configurable work factor

#### Random Generation
- Source: Web Crypto API (crypto.getRandomValues)
- CSPRNG backed by OS entropy

#### Proof-of-Work
- Algorithm: SHA-256
- Challenge: Find x where SHA256(prefix + nonce + x) has N leading zero bits
- Why: Client-side DoS mitigation

### Key Management

#### Key Generation
```
key = crypto.getRandomValues(32 bytes)
```

#### Key Transport
```
URL format: https://sealed.fyi/#<secretId>:<base64url(key)>
Fragment is never sent to server
```

#### Passphrase Enhancement
```
If passphrase provided:
  salt = crypto.getRandomValues(16 bytes)
  derivedKey = PBKDF2(passphrase, salt, 100000, SHA256)
  finalKey = XOR(randomKey, derivedKey)  // Or just use derivedKey to wrap randomKey
```

### Security Properties

#### Confidentiality
- AES-256 provides semantic security
- Key never leaves client
- Server stores only ciphertext

#### Integrity
- GCM provides authentication
- Tampering detected on decrypt

#### Forward Secrecy
- Each secret has unique random key
- Compromise of one doesn't affect others

### Threat Model
- Server compromise: Cannot read secrets
- Network observer: Sees only ciphertext
- Link interception: Full access (share securely)

### Test Vectors
Provide test vectors for interoperability:
```
plaintext: "Hello, World!"
key (hex): "..."
iv (hex): "..."
ciphertext (hex): "..."
```

## Exit Criteria
- [ ] All algorithms documented
- [ ] Rationale for choices explained
- [ ] Key management documented
- [ ] Security properties explained
- [ ] Test vectors provided
- [ ] Code reviewed
