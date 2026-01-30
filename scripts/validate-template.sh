#!/bin/bash
# scripts/validate-template.sh

set -e

echo "Validating SAM template..."

sam validate --template-file backend/template.yaml

echo "SAM template is valid."
