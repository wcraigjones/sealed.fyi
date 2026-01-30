# DynamoDB Schema

## Overview

sealed.fyi uses a single DynamoDB table to store encrypted secrets. The schema is designed for:

- **Minimal metadata** — only what's necessary for operation
- **Automatic expiration** — via DynamoDB TTL
- **Anti-oracle** — no fields that reveal secret state
- **Idempotency** — support for refresh/retry tolerance

---

## Table Definition

**Table Name:** `sealed-secrets`

**Billing Mode:** On-Demand (PAY_PER_REQUEST)

**Primary Key:**
| Attribute | Type | Role |
|-----------|------|------|
| `id` | String | Partition Key |

**No Sort Key** — each secret is uniquely identified by its ID.

**No Global Secondary Indexes** — all access is by primary key.

---

## Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | S | Yes | Secret identifier (22 chars, base64url) |
| `ciphertext` | S | Yes | Base64-encoded encrypted payload |
| `iv` | S | Yes | Base64-encoded initialization vector (12 bytes) |
| `salt` | S | No | Base64-encoded salt for passphrase derivation (16 bytes) |
| `passphraseProtected` | BOOL | Yes | Whether passphrase is required for decryption |
| `remainingViews` | N | Yes | Number of retrievals remaining (1-5) |
| `burnToken` | S | Yes | Token for early deletion (32 chars, hex) |
| `createdAt` | N | Yes | Unix timestamp (seconds) when secret was created |
| `expiresAt` | N | Yes | Unix timestamp (seconds) when secret expires (TTL) |
| `lastAccessAt` | N | No | Unix timestamp of last retrieval (for idempotency) |
| `lastAccessToken` | S | No | Random token from last retrieval (for idempotency) |

---

## Attribute Details

### id (Partition Key)

- **Format:** 22 characters, base64url alphabet
- **Entropy:** 128 bits (16 random bytes, sufficient to prevent guessing)
- **Generation:** Server-side using CSPRNG

```javascript
// Example generation
const bytes = crypto.randomBytes(16);
const id = bytes.toString('base64url').slice(0, 22);
```

### ciphertext

- **Format:** Base64-encoded binary data
- **Max Size:** ~68 KB (50 KB plaintext + encryption overhead + base64)
- **Contents:** AES-256-GCM encrypted payload with authentication tag

### iv (Initialization Vector)

- **Format:** Base64-encoded, exactly 12 bytes
- **Purpose:** Ensures unique encryption even with same key and plaintext
- **Generation:** Client-side using CSPRNG

### salt

- **Format:** Base64-encoded, exactly 16 bytes, or absent
- **Purpose:** Input to PBKDF2 for passphrase key derivation
- **Presence:** Only when `passphraseProtected` is true

### passphraseProtected

- **Type:** Boolean
- **Purpose:** Indicates whether client needs passphrase input for decryption
- **Note:** Server cannot verify passphrase; this is purely informational

### remainingViews

- **Type:** Number (integer)
- **Range:** 1-5 at creation, decremented on each retrieval
- **Behavior:** Secret is deleted when this reaches 0

### burnToken

- **Format:** 32 characters, hexadecimal
- **Entropy:** 128 bits
- **Purpose:** Allows creator to delete secret before expiration
- **Generation:** Server-side using CSPRNG

```javascript
// Example generation
const burnToken = crypto.randomBytes(16).toString('hex');
```

### createdAt

- **Type:** Number (Unix timestamp in seconds)
- **Purpose:** Audit/debugging (not exposed to users)

### expiresAt (TTL Attribute)

- **Type:** Number (Unix timestamp in seconds)
- **Purpose:** DynamoDB TTL for automatic deletion
- **Behavior:** DynamoDB deletes items within ~48 hours of expiration
- **Important:** Application must also check expiration on read

### lastAccessAt

- **Type:** Number (Unix timestamp in seconds)
- **Purpose:** Idempotency window tracking
- **Updated:** On each successful retrieval

### lastAccessToken

- **Format:** 32 characters, hexadecimal
- **Purpose:** Idempotency token for refresh/retry tolerance
- **Behavior:** If client provides matching token within 30s, view is not consumed

---

## TTL Configuration

```yaml
TimeToLiveSpecification:
  AttributeName: expiresAt
  Enabled: true
```

**Important Notes:**
- DynamoDB TTL deletion is **best-effort**, typically within 48 hours
- Application **must** check `expiresAt` on read and reject expired secrets
- This provides immediate enforcement while TTL handles cleanup

---

## Access Patterns

### Create Secret

```javascript
// PutItem
{
  TableName: 'sealed-secrets',
  Item: {
    id: { S: 'Ab3dEf6hIj9kLmNoPqRs' },
    ciphertext: { S: 'base64...' },
    iv: { S: 'base64...' },
    salt: { S: 'base64...' },  // or omit if not passphrase-protected
    passphraseProtected: { BOOL: false },
    remainingViews: { N: '1' },
    burnToken: { S: 'a1b2c3d4...' },
    createdAt: { N: '1706745600' },
    expiresAt: { N: '1706832000' }
  },
  ConditionExpression: 'attribute_not_exists(id)'  // Prevent overwrites
}
```

### Get Secret

```javascript
// GetItem
{
  TableName: 'sealed-secrets',
  Key: {
    id: { S: 'Ab3dEf6hIj9kLmNoPqRs' }
  }
}

// Then check:
// 1. Item exists
// 2. expiresAt > now (application-level expiry check)
// 3. remainingViews > 0
```

### Decrement Views and Update Access Token

```javascript
// UpdateItem with conditional expression
{
  TableName: 'sealed-secrets',
  Key: {
    id: { S: 'Ab3dEf6hIj9kLmNoPqRs' }
  },
  UpdateExpression: 'SET remainingViews = remainingViews - :one, lastAccessAt = :now, lastAccessToken = :token',
  ConditionExpression: 'remainingViews > :zero AND expiresAt > :now',
  ExpressionAttributeValues: {
    ':one': { N: '1' },
    ':zero': { N: '0' },
    ':now': { N: String(Math.floor(Date.now() / 1000)) },
    ':token': { S: 'newRandomToken...' }
  },
  ReturnValues: 'ALL_NEW'
}

// If remainingViews becomes 0, delete the item
```

### Idempotent Get (within window)

```javascript
// Check if within idempotency window before decrementing
// If lastAccessToken matches AND (now - lastAccessAt) < 30:
//   Return secret without decrementing
// Else:
//   Proceed with normal decrement
```

### Burn Secret

```javascript
// DeleteItem with condition
{
  TableName: 'sealed-secrets',
  Key: {
    id: { S: 'Ab3dEf6hIj9kLmNoPqRs' }
  },
  ConditionExpression: 'burnToken = :token',
  ExpressionAttributeValues: {
    ':token': { S: 'a1b2c3d4...' }
  }
}

// Ignore ConditionalCheckFailedException — always return 204
```

### Delete Expired/Consumed Secret

```javascript
// DeleteItem (unconditional)
{
  TableName: 'sealed-secrets',
  Key: {
    id: { S: 'Ab3dEf6hIj9kLmNoPqRs' }
  }
}
```

---

## CloudFormation Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: DynamoDB table for sealed.fyi secrets

Resources:
  SecretsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: sealed-secrets
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      BillingMode: PAY_PER_REQUEST
      TimeToLiveSpecification:
        AttributeName: expiresAt
        Enabled: true
      Tags:
        - Key: Project
          Value: sealed-fyi
        - Key: Environment
          Value: production

Outputs:
  TableName:
    Description: DynamoDB table name
    Value: !Ref SecretsTable
  TableArn:
    Description: DynamoDB table ARN
    Value: !GetAtt SecretsTable.Arn
```

---

## Data Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                         SECRET LIFECYCLE                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Created ──► Stored ──► Retrieved ──► Deleted                    │
│                │            │                                     │
│                │            ├── remainingViews = 0 → Delete      │
│                │            └── Idempotency window (30s)         │
│                │                                                  │
│                ├── Burned (via burnToken) → Delete               │
│                │                                                  │
│                └── Expired (TTL) → Delete (eventual)             │
│                    └── Also checked on read (immediate)          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

### What We Store
- Encrypted ciphertext (opaque to server)
- Metadata necessary for operation

### What We Don't Store
- Plaintext secrets
- Decryption keys
- User identifiers
- IP addresses
- User agents
- Referrers

### Assume Breach
All stored fields should be safe to disclose publicly:
- `ciphertext` is encrypted
- `id` has no meaning without the key
- `burnToken` only allows deletion (not access)
- Metadata reveals nothing about secret content

---

## Local Development

### DynamoDB Local Setup

```bash
# Start DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# Create table
aws dynamodb create-table 
  --endpoint-url http://localhost:8000 
  --table-name sealed-secrets 
  --attribute-definitions AttributeName=id,AttributeType=S 
  --key-schema AttributeName=id,KeyType=HASH 
  --billing-mode PAY_PER_REQUEST
```

### Environment Variable

```bash
DYNAMODB_ENDPOINT=http://localhost:8000
```

When set, Lambda functions should use this endpoint instead of the default AWS endpoint.
