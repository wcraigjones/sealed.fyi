# Phase 3, Stream F: Threat Model Documentation

## Goal
Create comprehensive threat model documentation.

## Files
- `docs/THREAT_MODEL.md`

## Content

### Assets
What we're protecting:
- Secret content (plaintext)
- Decryption keys
- Metadata (who created, when, etc.)

### Trust Boundaries

```
┌─────────────────────────────────────────────────────┐
│                    USER BROWSER                      │
│  ┌─────────────────────────────────────────────────┐│
│  │ Trusted Zone                                     ││
│  │ - Plaintext secret                              ││
│  │ - Decryption key                                ││
│  │ - Passphrase                                    ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
                        │
                        │ HTTPS (ciphertext only)
                        ▼
┌─────────────────────────────────────────────────────┐
│                    SERVER                            │
│  ┌─────────────────────────────────────────────────┐│
│  │ Untrusted with Secrets                          ││
│  │ - Only sees ciphertext                          ││
│  │ - Cannot decrypt                                ││
│  │ - Stores encrypted blob                         ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### Threat Actors

#### Passive Network Observer
- Capabilities: Monitor network traffic
- Mitigations: HTTPS, encryption before transmission

#### Active Network Attacker
- Capabilities: MITM, modify traffic
- Mitigations: HTTPS, certificate pinning (browser)

#### Malicious Server Operator
- Capabilities: Read all server data, logs
- Mitigations: Client-side encryption, no key on server

#### Link Interceptor
- Capabilities: Obtain shared link
- Mitigations: Passphrase option, secure sharing practices

#### Automated Abuse
- Capabilities: Mass secret creation
- Mitigations: PoW, rate limiting, token expiry

#### Preview Bots
- Capabilities: Auto-fetch URLs
- Mitigations: Explicit "Reveal" click, no auto-fetch

### Attack Vectors

| Attack | Vector | Mitigation | Residual Risk |
|--------|--------|------------|---------------|
| Read secrets | Server access | E2E encryption | None |
| Guess secret ID | Brute force | High-entropy IDs, rate limiting | Low |
| Replay token | Token reuse | Nonce, short TTL | None |
| Consume secret | Preview bot | Click-to-reveal | Low |
| Mass creation | Automation | PoW | Low |
| Timing oracle | Response timing | Uniform responses | Low |
| State oracle | Error messages | Uniform 404s | None |

### Assumptions
What we assume to be true:
- Browser is not compromised
- TLS is secure
- User shares link via secure channel
- Cryptographic primitives are secure

### Residual Risks
What remains after mitigations:
- Compromised browser can read secrets
- Link shared insecurely can be intercepted
- Screenshots/copy-paste outside our control
- Quantum computing (future)

### Security Guarantees
What we promise:
- Server cannot read secrets
- Expired secrets are unrecoverable
- Single-use secrets are destroyed after viewing
- No PII collected or stored

### Non-Guarantees
What we don't promise:
- Protection against compromised endpoint
- Protection against social engineering
- Protection against rubber-hose cryptanalysis
- Guaranteed delivery of secret

## Exit Criteria
- [ ] All assets identified
- [ ] Trust boundaries documented
- [ ] Threat actors enumerated
- [ ] Attack vectors analyzed
- [ ] Mitigations documented
- [ ] Residual risks acknowledged
- [ ] Code reviewed
