# Phase 4, Stream D: Deployment Scripts

## Goal
Create deployment automation scripts.

## Files
- `scripts/deploy-backend.sh`
- `scripts/deploy-frontend.sh`
- `scripts/deploy-all.sh`
- `scripts/rollback.sh`

## deploy-backend.sh

```bash
#!/bin/bash
set -e

STACK_NAME="sealed-fyi-backend"
REGION="us-east-1"

echo "Building backend..."
cd backend
sam build

echo "Deploying backend..."
sam deploy 
  --stack-name $STACK_NAME 
  --region $REGION 
  --capabilities CAPABILITY_IAM 
  --parameter-overrides 
    JwtSecret=$JWT_SECRET 
  --no-confirm-changeset 
  --no-fail-on-empty-changeset

echo "Backend deployed successfully!"
echo "API URL: $(aws cloudformation describe-stacks 
  --stack-name $STACK_NAME 
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' 
  --output text)"
```

## deploy-frontend.sh

```bash
#!/bin/bash
set -e

S3_BUCKET="sealed-fyi-frontend"
DISTRIBUTION_ID="EXXXXXXXXXX"  # CloudFront distribution ID

echo "Syncing frontend to S3..."
aws s3 sync frontend/ s3://$S3_BUCKET/ 
  --delete 
  --cache-control "no-store" 
  --exclude "*.js" 
  --exclude "*.css"

# Static assets with long cache
aws s3 sync frontend/js/ s3://$S3_BUCKET/js/ 
  --cache-control "public, max-age=31536000, immutable"
aws s3 sync frontend/css/ s3://$S3_BUCKET/css/ 
  --cache-control "public, max-age=31536000, immutable"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation 
  --distribution-id $DISTRIBUTION_ID 
  --paths "/*"

echo "Frontend deployed successfully!"
```

## deploy-all.sh

```bash
#!/bin/bash
set -e

echo "=== Deploying sealed.fyi ==="

# Check required env vars
if [ -z "$JWT_SECRET" ]; then
  echo "Error: JWT_SECRET not set"
  exit 1
fi

# Deploy backend first
echo "--- Deploying Backend ---"
./scripts/deploy-backend.sh

# Deploy frontend
echo "--- Deploying Frontend ---"
./scripts/deploy-frontend.sh

echo "=== Deployment Complete ==="
echo "Site: https://sealed.fyi"
```

## rollback.sh

```bash
#!/bin/bash
set -e

STACK_NAME="sealed-fyi-backend"
REGION="us-east-1"

# Get previous deployment
echo "Fetching previous deployment..."

# For SAM, rollback by redeploying previous version
# Or use CloudFormation rollback

echo "Rolling back CloudFormation stack..."
aws cloudformation rollback-stack 
  --stack-name $STACK_NAME 
  --region $REGION

echo "Waiting for rollback to complete..."
aws cloudformation wait stack-rollback-complete 
  --stack-name $STACK_NAME 
  --region $REGION

echo "Rollback complete!"
```

## Environment Variables
| Variable | Description |
|----------|-------------|
| JWT_SECRET | JWT signing secret (production value) |
| AWS_REGION | AWS region (default: us-east-1) |

## Usage
```bash
# Deploy everything
JWT_SECRET=<secret> ./scripts/deploy-all.sh

# Deploy backend only
JWT_SECRET=<secret> ./scripts/deploy-backend.sh

# Deploy frontend only
./scripts/deploy-frontend.sh

# Rollback
./scripts/rollback.sh
```

## Exit Criteria
- [ ] All scripts created
- [ ] Scripts executable (`chmod +x`)
- [ ] Backend deploys successfully
- [ ] Frontend deploys successfully
- [ ] Rollback works
- [ ] Documentation complete
- [ ] Code reviewed
