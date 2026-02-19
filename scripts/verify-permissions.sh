#!/usr/bin/env bash
# Permission mapping verification script
# Validates that frontend sidebar permissions match backend seed definitions
# and that backend API permissions match seed definitions.
# Run: bash scripts/verify-permissions.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=0

echo "=== Permission Mapping Verification ==="
echo ""

# 1. Extract frontend sidebar permissions
echo "[1/4] Extracting frontend sidebar permissions..."
FRONTEND_PERMS=$(grep "permission:" "$ROOT/frontend/src/components/sidebar-nav.tsx" \
  | sed "s/.*permission: '//;s/'.*//" \
  | sort -u)

FRONTEND_COUNT=$(echo "$FRONTEND_PERMS" | wc -l | tr -d ' ')
echo "  Found $FRONTEND_COUNT unique permissions in sidebar"

# 2. Extract seed permission module.action strings
echo "[2/4] Extracting backend seed permissions..."
SEED_PERMS=$(sed -n '/^PERMISSION_MODULES/,/^}/p' "$ROOT/backend/scripts/seed.py" \
  | awk -F'"' '
    /^[[:space:]]*"[a-z_]+"/ { module = $2 }
    /\[/ {
      n = split($0, arr, "\"")
      for (i = 1; i <= n; i++) {
        if (arr[i] ~ /^[a-z_]+$/ && arr[i] != module) {
          print module "." arr[i]
        }
      }
    }
  ' | sort -u)

SEED_COUNT=$(echo "$SEED_PERMS" | wc -l | tr -d ' ')
echo "  Found $SEED_COUNT permissions in seed"

# 3. Cross-validate frontend vs seed
echo ""
echo "[3/4] Validating frontend permissions against seed..."
MISSING=0
while IFS= read -r perm; do
  if ! echo "$SEED_PERMS" | grep -qx "$perm"; then
    echo "  ERROR: Frontend sidebar uses '$perm' but NOT defined in backend seed"
    MISSING=$((MISSING + 1))
    ERRORS=$((ERRORS + 1))
  fi
done <<< "$FRONTEND_PERMS"

if [ "$MISSING" -eq 0 ]; then
  echo "  PASS: All frontend sidebar permissions exist in backend seed"
fi

# 4. Cross-validate backend API PermissionChecker vs seed
echo ""
echo "[4/4] Validating backend API permissions against seed..."
API_PERMS=$(grep -rho 'PermissionChecker("[^"]*")' "$ROOT/backend/app/api/" \
  | sed 's/PermissionChecker("//;s/")//' \
  | sort -u)

# Also catch single-quoted PermissionChecker
API_PERMS_SQ=$(grep -rho "PermissionChecker('[^']*')" "$ROOT/backend/app/api/" \
  | sed "s/PermissionChecker('//;s/')//" \
  | sort -u)

API_PERMS=$(printf "%s\n%s" "$API_PERMS" "$API_PERMS_SQ" | grep -v '^$' | sort -u)

API_COUNT=$(echo "$API_PERMS" | wc -l | tr -d ' ')
echo "  Found $API_COUNT unique permissions in backend API"

API_MISSING=0
while IFS= read -r perm; do
  if ! echo "$SEED_PERMS" | grep -qx "$perm"; then
    echo "  ERROR: Backend API uses '$perm' but NOT defined in seed"
    API_MISSING=$((API_MISSING + 1))
    ERRORS=$((ERRORS + 1))
  fi
done <<< "$API_PERMS"

if [ "$API_MISSING" -eq 0 ]; then
  echo "  PASS: All backend API permissions exist in seed"
fi

# Summary
echo ""
echo "=== Summary ==="
echo "  Frontend sidebar: $FRONTEND_COUNT permissions"
echo "  Backend API:      $API_COUNT permissions"
echo "  Seed defined:     $SEED_COUNT permissions"
echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "RESULT: PASS - All permissions are consistent"
  exit 0
else
  echo "RESULT: FAIL - $ERRORS permission mismatch(es) found"
  exit 1
fi
