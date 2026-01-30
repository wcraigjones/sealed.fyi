#!/bin/bash
# sealed.fyi local development setup
# Usage: ./scripts/local-setup.sh
#
# This script:
# 1. Starts DynamoDB Local in Docker
# 2. Creates the secrets table
# 3. Starts SAM local API

set -e

# Configuration
DYNAMODB_PORT=8000
DYNAMODB_ENDPOINT_HOST="http://localhost:${DYNAMODB_PORT}"
DYNAMODB_ENDPOINT_DOCKER="http://host.docker.internal:${DYNAMODB_PORT}"
SAM_PORT=3000
TABLE_NAME="sealed-secrets"
JWT_SECRET="local-dev-secret"

# Dummy AWS credentials for DynamoDB Local (required but not validated)
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local
export AWS_DEFAULT_REGION=us-east-1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== sealed.fyi Local Development Setup ===${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}Error: AWS CLI is not installed${NC}"
        exit 1
    fi
    
    if ! command -v sam &> /dev/null; then
        echo -e "${RED}Error: AWS SAM CLI is not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ All prerequisites installed${NC}"
}

# Start DynamoDB Local
start_dynamodb() {
    echo -e "${YELLOW}Starting DynamoDB Local on port ${DYNAMODB_PORT}...${NC}"
    
    # Stop existing container if running
    docker stop dynamodb-local 2>/dev/null || true
    docker rm dynamodb-local 2>/dev/null || true
    
    # Start new container
    docker run -d 
        -p ${DYNAMODB_PORT}:8000 
        --name dynamodb-local 
        amazon/dynamodb-local 
        -jar DynamoDBLocal.jar -sharedDb
    
    # Wait for DynamoDB to be ready
    echo "Waiting for DynamoDB Local to be ready..."
    for i in {1..30}; do
        if aws dynamodb list-tables --endpoint-url ${DYNAMODB_ENDPOINT_HOST} &>/dev/null; then
            echo -e "${GREEN}✓ DynamoDB Local is ready${NC}"
            return 0
        fi
        sleep 1
    done
    
    echo -e "${RED}Error: DynamoDB Local failed to start${NC}"
    exit 1
}

# Create DynamoDB table
create_table() {
    echo -e "${YELLOW}Creating DynamoDB table '${TABLE_NAME}'...${NC}"
    
    # Check if table already exists
    if aws dynamodb describe-table 
        --table-name ${TABLE_NAME} 
        --endpoint-url ${DYNAMODB_ENDPOINT_HOST} 
        &>/dev/null; then
        echo -e "${GREEN}✓ Table '${TABLE_NAME}' already exists${NC}"
        return 0
    fi
    
    # Create the table
    aws dynamodb create-table 
        --table-name ${TABLE_NAME} 
        --attribute-definitions AttributeName=id,AttributeType=S 
        --key-schema AttributeName=id,KeyType=HASH 
        --billing-mode PAY_PER_REQUEST 
        --endpoint-url ${DYNAMODB_ENDPOINT_HOST}
    
    echo -e "${GREEN}✓ Table '${TABLE_NAME}' created${NC}"
}

# Start SAM local API
start_sam() {
    echo -e "${YELLOW}Starting SAM local API on port ${SAM_PORT}...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    echo ""
    echo -e "${GREEN}API will be available at: http://localhost:${SAM_PORT}${NC}"
    echo ""
    
    cd "$(dirname "$0")/../backend"
    
    # Export environment variables for Lambda functions
    export JWT_SECRET="${JWT_SECRET}"
    export DYNAMODB_TABLE="${TABLE_NAME}"
    
    # Start SAM local API
    # Note: Using host.docker.internal because SAM runs Lambda in Docker containers
    sam local start-api 
        --warm-containers EAGER 
        --host 0.0.0.0 
        --port ${SAM_PORT} 
        --env-vars <(cat <<EOF
{
    "CreateTokenFunction": {
        "JWT_SECRET": "${JWT_SECRET}",
        "DYNAMODB_TABLE": "${TABLE_NAME}",
        "DYNAMODB_ENDPOINT": "${DYNAMODB_ENDPOINT_DOCKER}"
    },
    "CreateSecretFunction": {
        "JWT_SECRET": "${JWT_SECRET}",
        "DYNAMODB_TABLE": "${TABLE_NAME}",
        "DYNAMODB_ENDPOINT": "${DYNAMODB_ENDPOINT_DOCKER}"
    },
    "GetSecretFunction": {
        "JWT_SECRET": "${JWT_SECRET}",
        "DYNAMODB_TABLE": "${TABLE_NAME}",
        "DYNAMODB_ENDPOINT": "${DYNAMODB_ENDPOINT_DOCKER}"
    },
    "BurnSecretFunction": {
        "JWT_SECRET": "${JWT_SECRET}",
        "DYNAMODB_TABLE": "${TABLE_NAME}",
        "DYNAMODB_ENDPOINT": "${DYNAMODB_ENDPOINT_DOCKER}"
    }
}
EOF
)
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Cleaning up...${NC}"
    docker stop dynamodb-local 2>/dev/null || true
    echo -e "${GREEN}Done${NC}"
}

# Set trap for cleanup on exit
trap cleanup EXIT

# Main execution
check_prerequisites
start_dynamodb
create_table
start_sam
