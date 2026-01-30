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
        - http://localhost:3000
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
```yaml
CreateTokenFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: index.handler
    Runtime: nodejs20.x
    CodeUri: functions/create-token/
    Environment:
      Variables:
        JWT_SECRET: !Ref JwtSecret
        DYNAMODB_TABLE: !Ref SecretsTable
    Events:
      Api:
        Type: HttpApi
        Properties:
          Path: /token
          Method: POST
          ApiId: !Ref ApiGateway

# Similar for create-secret, get-secret, burn-secret
```

**Parameters:**
```yaml
Parameters:
  JwtSecret:
    Type: String
    NoEcho: true
    Description: Secret for signing JWTs
```

### Outputs
- API Gateway URL
- DynamoDB table name

## samconfig.toml

```toml
version = 0.1

[default.deploy.parameters]
stack_name = "sealed-fyi"
resolve_s3 = true
s3_prefix = "sealed-fyi"
region = "us-east-1"
capabilities = "CAPABILITY_IAM"
parameter_overrides = "JwtSecret=CHANGE_ME_IN_PRODUCTION"

[default.local_start_api.parameters]
warm_containers = "EAGER"
```

## Local Setup Script (scripts/local-setup.sh)

```bash
#!/bin/bash
set -e

echo "Starting DynamoDB Local..."
docker run -d -p 8000:8000 --name dynamodb-local amazon/dynamodb-local || true

echo "Waiting for DynamoDB..."
sleep 2

echo "Creating table..."
aws dynamodb create-table 
  --endpoint-url http://localhost:8000 
  --table-name sealed-secrets 
  --attribute-definitions AttributeName=id,AttributeType=S 
  --key-schema AttributeName=id,KeyType=HASH 
  --billing-mode PAY_PER_REQUEST 
  2>/dev/null || echo "Table already exists"

echo "Starting SAM local API..."
cd backend
JWT_SECRET=local-dev-secret 
DYNAMODB_TABLE=sealed-secrets 
DYNAMODB_ENDPOINT=http://host.docker.internal:8000 
sam local start-api --warm-containers EAGER

# Note: Use http://localhost:8000 if not using Docker for SAM
```

## Environment Variables

| Variable | Description | Local Value |
|----------|-------------|-------------|
| JWT_SECRET | JWT signing secret | local-dev-secret |
| DYNAMODB_TABLE | Table name | sealed-secrets |
| DYNAMODB_ENDPOINT | DynamoDB endpoint | http://localhost:8000 |

## Exit Criteria
- [ ] template.yaml is valid (`sam validate`)
- [ ] Local DynamoDB starts successfully
- [ ] SAM local API starts successfully
- [ ] All Lambda endpoints respond
- [ ] CORS headers present
- [ ] Code reviewed
