#!/bin/bash
# Generate TypeScript types from FastAPI OpenAPI schema
# Run from project root: ./scripts/generate-types.sh

set -e

API_URL="${API_URL:-http://localhost:8000}"
OUTPUT_DIR="frontend/src/types"
OUTPUT_FILE="$OUTPUT_DIR/api.generated.ts"

echo "Fetching OpenAPI schema from $API_URL/openapi.json..."
curl -s "$API_URL/openapi.json" > /tmp/openapi.json

echo "Generating TypeScript types..."
cd frontend && npx openapi-typescript /tmp/openapi.json -o "src/types/api.generated.ts"

echo "Types generated at $OUTPUT_FILE"
