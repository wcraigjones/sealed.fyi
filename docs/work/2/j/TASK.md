# Phase 2, Stream J: Infrastructure & Local Development

## Goal
Create SAM template and local development setup.

## Files
- `backend/template.yaml`
- `backend/samconfig.toml`
- `scripts/local-setup.sh`

## SAM Template (template.yaml)

### Resources

**DynamoDB Table:**
```yaml
SecretsTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: !Sub "sealed-secrets-${Environment}"
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
```

**API Gateway:**
```yaml
ApiGateway:
  Type: AWS::Serverless::HttpApi
  Properties:
    StageName: api
    CorsConfiguration:
      AllowOrigins:
        - https://sealed.fyi
        - http://localhost:3000  # dev only
      AllowMethods:
        - GET
        - POST
        - DELETE
        - OPTIONS
      AllowHeaders:
        - Authorization
        - Content-Type
        - X-Burn-Token
```

**Lambda Functions:**
- CreateTokenFunction (POST /token) - No DynamoDB access needed
- CreateSecretFunction (POST /secrets) - PutItem only
- GetSecretFunction (GET /secrets/{id}) - GetItem, UpdateItem, DeleteItem
- BurnSecretFunction (DELETE /secrets/{id}) - DeleteItem only

**Parameters:**
- JwtSecret (NoEcho, min 16 chars)
- Environment (dev | production)

### Outputs
- API Gateway URL
- DynamoDB table name/ARN
- Lambda function ARNs

## samconfig.toml

```toml
version = 0.1

[default.global.parameters]
stack_name = "sealed-fyi"

[default.deploy.parameters]
resolve_s3 = true
s3_prefix = "sealed-fyi"
region = "us-east-1"
capabilities = "CAPABILITY_IAM"
confirm_changeset = true
```

## Local Setup Script (scripts/local-setup.sh)

```bash
#!/bin/bash
# Features:
# - Prerequisite checks (docker, aws, sam)
# - Starts DynamoDB Local in Docker
# - Creates sealed-secrets table
# - Starts SAM local API with environment variables
# - Cleanup on exit (stops Docker container)
```

## Environment Variables

| Variable | Description | Local Value |
|----------|-------------|-------------|
| JWT_SECRET | JWT signing secret | local-dev-secret |
| DYNAMODB_TABLE | Table name | sealed-secrets |
| DYNAMODB_ENDPOINT | DynamoDB endpoint | http://host.docker.internal:8000 |

## Exit Criteria

- [x] template.yaml is valid (`sam validate --lint`)
- [x] Local DynamoDB starts successfully
- [x] Table creation works
- [x] SAM local API configuration complete
- [x] Least-privilege IAM policies (reviewed)
- [x] CORS configuration correct
- [x] Code reviewed via mega-review

## Completed

- **Date:** 2026-01-30
- **Summary:** Implemented SAM template, samconfig.toml, and local-setup.sh. Template includes:
  - DynamoDB table with TTL on expiresAt
  - HTTP API Gateway with environment-aware CORS
  - Four Lambda functions with least-privilege IAM policies
  - Environment parameter for dev/production isolation
  - Environment-prefixed resource names to prevent conflicts
  
  Local setup script includes:
  - Prerequisite checks
  - DynamoDB Local via Docker
  - Table creation
  - SAM local API with proper environment variables
  - Cleanup on exit
  
- **Review Notes:** Mega-review recommended IAM policy tightening (implemented), environment-aware table naming (implemented), and dummy AWS credentials for local dev (implemented).

- **Placeholder Files:** Created minimal placeholder index.js files for each Lambda function to allow SAM validation. These will be replaced by Phases 2C-2F.