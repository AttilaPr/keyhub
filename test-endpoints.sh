#!/bin/bash
# Comprehensive endpoint test script for KeyHub
# Tests all API endpoints with fake seeded data

BASE="http://localhost:4200"
PASS=0
FAIL=0
WARN=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

check() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  local body="$4"

  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}✓${NC} $desc (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $desc (expected $expected, got $actual)"
    if [ -n "$body" ]; then
      echo "    Response: $(echo "$body" | head -c 200)"
    fi
    FAIL=$((FAIL + 1))
  fi
}

warn() {
  local desc="$1"
  local actual="$2"
  local body="$3"
  echo -e "  ${YELLOW}⚠${NC} $desc (HTTP $actual)"
  if [ -n "$body" ]; then
    echo "    Response: $(echo "$body" | head -c 200)"
  fi
  WARN=$((WARN + 1))
}

echo "================================================"
echo "  KeyHub Endpoint Test Suite"
echo "================================================"
echo ""

# ──────────────────────────────────────────────
# 1. Public endpoints (no auth needed)
# ──────────────────────────────────────────────
echo "1. PUBLIC ENDPOINTS"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/health")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/health" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/status")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/status (requires auth, redirects)" "307" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/setup-status")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/setup-status (requires auth, redirects)" "307" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 2. Auth endpoints (unauthenticated)
# ──────────────────────────────────────────────
echo "2. AUTH ENDPOINTS (unauthenticated)"

# Login - get CSRF token from NextAuth first
RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/auth/csrf")
CODE=$(echo "$RESP" | tail -1)
check "GET /api/auth/csrf" "200" "$CODE"

# Test register endpoint with missing fields (public route, no auth needed)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /api/auth/register (missing fields)" "400" "$CODE" "$BODY"

# Register duplicate email (returns 201 to prevent email enumeration)
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"TestPassword123!","name":"Duplicate"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /api/auth/register (duplicate email, same response)" "201" "$CODE" "$BODY"

# Email verification with invalid token (GET endpoint)
RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/auth/verify-email?token=invalid-token-xyz")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/auth/verify-email (invalid token)" "400" "$CODE" "$BODY"

# Resend verification for non-existent email
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/auth/resend-verification" \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@example.com"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
# Should return 200 even for non-existent emails (security: don't leak existence)
check "POST /api/auth/resend-verification (non-existent)" "200" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 3. Login and get session cookie
# ──────────────────────────────────────────────
echo "3. AUTHENTICATION"

# Get NextAuth CSRF token
CSRF_RESP=$(curl -s -c /tmp/keyhub-cookies.txt "$BASE/api/auth/csrf")
NEXTAUTH_CSRF=$(echo "$CSRF_RESP" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)

# Login as alice
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/auth/callback/credentials" \
  -b /tmp/keyhub-cookies.txt -c /tmp/keyhub-cookies.txt \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=alice%40example.com&password=user123&csrfToken=${NEXTAUTH_CSRF}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
# NextAuth returns 302 on successful login
if [ "$LOGIN_CODE" = "302" ] || [ "$LOGIN_CODE" = "200" ]; then
  echo -e "  ${GREEN}✓${NC} Login as alice@example.com (HTTP $LOGIN_CODE)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Login as alice@example.com (HTTP $LOGIN_CODE)"
  FAIL=$((FAIL + 1))
fi

# Verify session
RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/auth/session")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/auth/session (authenticated)" "200" "$CODE" "$BODY"

# Get CSRF cookie for mutations
RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt -c /tmp/keyhub-cookies.txt "$BASE/dashboard")
CSRF_TOKEN=$(grep '__keyhub_csrf' /tmp/keyhub-cookies.txt | awk '{print $NF}')
echo "  CSRF token: ${CSRF_TOKEN:0:20}..."

echo ""

# ──────────────────────────────────────────────
# 4. Dashboard & user endpoints (authenticated as alice)
# ──────────────────────────────────────────────
echo "4. DASHBOARD ENDPOINTS (as alice)"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/dashboard")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/dashboard" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/usage")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/usage" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/usage/what-if?model=gpt-4o&inputTokens=1000&outputTokens=500")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/usage/what-if" "200" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 5. Provider keys endpoints
# ──────────────────────────────────────────────
echo "5. PROVIDER KEYS"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/keys/provider")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/keys/provider" "200" "$CODE" "$BODY"

# Create a new provider key
RESP=$(curl -s -w "\n%{http_code}" -X POST -b /tmp/keyhub-cookies.txt \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF_TOKEN" \
  -d '{"provider":"mistral","label":"Test Mistral","apiKey":"sk-fake-mistral-test"}' \
  "$BASE/api/keys/provider")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /api/keys/provider (create)" "201" "$CODE" "$BODY"
NEW_KEY_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# PATCH provider key
if [ -n "$NEW_KEY_ID" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X PATCH -b /tmp/keyhub-cookies.txt \
    -H "Content-Type: application/json" \
    -H "x-csrf-token: $CSRF_TOKEN" \
    -d "{\"id\":\"$NEW_KEY_ID\",\"isActive\":false}" \
    "$BASE/api/keys/provider")
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  check "PATCH /api/keys/provider (deactivate)" "200" "$CODE" "$BODY"

  # DELETE provider key
  RESP=$(curl -s -w "\n%{http_code}" -X DELETE -b /tmp/keyhub-cookies.txt \
    -H "x-csrf-token: $CSRF_TOKEN" \
    "$BASE/api/keys/provider?id=$NEW_KEY_ID")
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  check "DELETE /api/keys/provider" "200" "$CODE" "$BODY"
fi

echo ""

# ──────────────────────────────────────────────
# 6. Platform keys endpoints
# ──────────────────────────────────────────────
echo "6. PLATFORM KEYS"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/keys/platform")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/keys/platform" "200" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 7. Logs endpoints
# ──────────────────────────────────────────────
echo "7. LOGS"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/logs?page=1&limit=10")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/logs" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/logs/export")
CODE=$(echo "$RESP" | tail -1)
check "GET /api/logs/export" "200" "$CODE"

echo ""

# ──────────────────────────────────────────────
# 8. Audit endpoints
# ──────────────────────────────────────────────
echo "8. AUDIT"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/audit?page=1&limit=10")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/audit" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/audit/export")
CODE=$(echo "$RESP" | tail -1)
check "GET /api/audit/export" "200" "$CODE"

echo ""

# ──────────────────────────────────────────────
# 9. Organizations endpoints
# ──────────────────────────────────────────────
echo "9. ORGANIZATIONS"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/orgs")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/orgs" "200" "$CODE" "$BODY"
ORG_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ORG_ID" ]; then
  # /api/orgs/[id] only has PATCH/DELETE, no GET handler
  RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/orgs/$ORG_ID")
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  check "GET /api/orgs/[id] (no GET handler, 405)" "405" "$CODE" "$BODY"

  RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/orgs/$ORG_ID/members")
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  check "GET /api/orgs/[id]/members" "200" "$CODE" "$BODY"

  RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/orgs/$ORG_ID/invites")
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  check "GET /api/orgs/[id]/invites" "200" "$CODE" "$BODY"
fi

echo ""

# ──────────────────────────────────────────────
# 10. Templates endpoints
# ──────────────────────────────────────────────
echo "10. TEMPLATES"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/templates")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/templates" "200" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 11. Webhooks endpoints
# ──────────────────────────────────────────────
echo "11. WEBHOOKS"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/webhooks")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/webhooks" "200" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 12. Settings endpoints
# ──────────────────────────────────────────────
echo "12. SETTINGS"

# /api/settings/profile only has PATCH, no GET handler
RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/settings/profile")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/settings/profile (PATCH only, 405)" "405" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/settings/notifications")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/settings/notifications" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/budget")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/budget" "200" "$CODE" "$BODY"

# /api/budget/check is POST only
RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/budget/check")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/budget/check (POST only, 405)" "405" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 13. TOTP endpoints (status check only)
# ──────────────────────────────────────────────
echo "13. TOTP"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/auth/totp/status")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/auth/totp/status" "200" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 14. Announcements endpoints
# ──────────────────────────────────────────────
echo "14. ANNOUNCEMENTS"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/announcements")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/announcements" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/notifications/count")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/notifications/count" "200" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 15. Anomalies endpoints
# ──────────────────────────────────────────────
echo "15. ANOMALIES"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/anomalies")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/anomalies" "200" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 16. Unauthenticated access to protected endpoints
# ──────────────────────────────────────────────
echo "16. AUTH GUARDS (unauthenticated access)"

# Middleware redirects unauthenticated API requests to /login (307)
RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/dashboard")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/dashboard (no auth, redirects)" "307" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/keys/provider")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/keys/provider (no auth, redirects)" "307" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/logs")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/logs (no auth, redirects)" "307" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 17. Admin endpoints (as regular user - should be hidden)
# ──────────────────────────────────────────────
echo "17. ADMIN GUARDS (as regular user)"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/admin/users")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/users (non-admin)" "404" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/admin/keys")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/keys (non-admin)" "404" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/admin/audit")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/audit (non-admin)" "404" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 18. Login as admin
# ──────────────────────────────────────────────
echo "18. ADMIN AUTHENTICATION"

rm -f /tmp/keyhub-admin-cookies.txt
CSRF_RESP=$(curl -s -c /tmp/keyhub-admin-cookies.txt "$BASE/api/auth/csrf")
ADMIN_CSRF=$(echo "$CSRF_RESP" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)

LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/auth/callback/credentials" \
  -b /tmp/keyhub-admin-cookies.txt -c /tmp/keyhub-admin-cookies.txt \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=admin%40keyhub.dev&password=admin123&csrfToken=${ADMIN_CSRF}")
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
if [ "$LOGIN_CODE" = "302" ] || [ "$LOGIN_CODE" = "200" ]; then
  echo -e "  ${GREEN}✓${NC} Login as admin@keyhub.dev (HTTP $LOGIN_CODE)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Login as admin@keyhub.dev (HTTP $LOGIN_CODE)"
  FAIL=$((FAIL + 1))
fi

# Get session and CSRF cookie for admin
curl -s -b /tmp/keyhub-admin-cookies.txt -c /tmp/keyhub-admin-cookies.txt "$BASE/dashboard" > /dev/null
ADMIN_CSRF_TOKEN=$(grep '__keyhub_csrf' /tmp/keyhub-admin-cookies.txt | awk '{print $NF}')

echo ""

# ──────────────────────────────────────────────
# 19. Admin endpoints (as admin)
# ──────────────────────────────────────────────
echo "19. ADMIN ENDPOINTS (as admin)"

# Note: If ADMIN_SECRET_KEY is set, admin routes need the unlock cookie
# For testing without ADMIN_SECRET_KEY, these should work directly

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/users")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/users" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/keys?type=platform")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/keys (platform)" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/keys?type=provider")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/keys (provider)" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/logs")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/logs" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/audit")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/audit" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/orgs")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/orgs" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/stats")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/stats" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/flags")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/flags" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/plans")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/plans" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/announcements")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/announcements" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/finance/summary")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/finance/summary" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/finance/users")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/finance/users" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/pricing")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/pricing" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/health")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/health" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/search?q=alice")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/search" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/system/config")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/admin/system/config" "200" "$CODE" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/audit/export")
CODE=$(echo "$RESP" | tail -1)
check "GET /api/admin/audit/export" "200" "$CODE"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-admin-cookies.txt "$BASE/api/admin/logs/export")
CODE=$(echo "$RESP" | tail -1)
check "GET /api/admin/logs/export" "200" "$CODE"

echo ""

# ──────────────────────────────────────────────
# 20. CSRF protection test
# ──────────────────────────────────────────────
echo "20. CSRF PROTECTION"

# Mutation without CSRF token should fail
RESP=$(curl -s -w "\n%{http_code}" -X POST -b /tmp/keyhub-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"provider":"openai","label":"NoCsrf","apiKey":"sk-test"}' \
  "$BASE/api/keys/provider")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /api/keys/provider (no CSRF)" "403" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 21. V1 API endpoint (OpenAI-compatible proxy)
# ──────────────────────────────────────────────
echo "21. V1 API (OpenAI-compatible)"

# Without API key
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /api/v1/chat/completions (no key)" "401" "$CODE" "$BODY"

# With invalid API key
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer kh_invalid_key_123" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /api/v1/chat/completions (invalid key)" "401" "$CODE" "$BODY"

# Models endpoint (requires API key)
RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/v1/models")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/v1/models (no key)" "401" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# 22. Invite endpoint
# ──────────────────────────────────────────────
echo "22. INVITES"

RESP=$(curl -s -w "\n%{http_code}" -b /tmp/keyhub-cookies.txt "$BASE/api/invites/invite-token-abc123")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "GET /api/invites/[token]" "200" "$CODE" "$BODY"

# Accept invite with wrong email (alice's email doesn't match invite email)
RESP=$(curl -s -w "\n%{http_code}" -X POST -b /tmp/keyhub-cookies.txt \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF_TOKEN" \
  "$BASE/api/invites/invite-token-abc123")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
check "POST /api/invites/[token] (wrong email)" "400" "$CODE" "$BODY"

echo ""

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────
echo "================================================"
echo "  TEST RESULTS"
echo "================================================"
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
echo -e "  ${YELLOW}Warnings: $WARN${NC}"
echo "  Total: $((PASS + FAIL + WARN))"
echo "================================================"

# Cleanup
rm -f /tmp/keyhub-cookies.txt /tmp/keyhub-admin-cookies.txt

if [ $FAIL -gt 0 ]; then
  exit 1
fi
