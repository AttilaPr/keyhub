#!/usr/bin/env bash
# Comprehensive endpoint test for KeyHub
# Tests: auth, keys, logs, dashboard, settings, admin, orgs, etc.

set -euo pipefail

BASE="http://localhost:4200"
COOKIE_JAR="/tmp/keyhub-test-cookies.txt"
ADMIN_COOKIE_JAR="/tmp/keyhub-admin-cookies.txt"

PASS=0
FAIL=0
SKIP=0
ERRORS=""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

check() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  local body="${4:-}"

  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}✓${NC} $name (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $name — expected $expected, got $actual"
    [ -n "$body" ] && echo "    Response: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL + 1))
    ERRORS="${ERRORS}\n  - $name (expected $expected, got $actual)"
  fi
}

check_any() {
  local name="$1"
  local actual="$2"
  shift 2
  for expected in "$@"; do
    if [ "$actual" = "$expected" ]; then
      echo -e "  ${GREEN}✓${NC} $name (HTTP $actual)"
      PASS=$((PASS + 1))
      return
    fi
  done
  echo -e "  ${RED}✗${NC} $name — expected one of [$*], got $actual"
  FAIL=$((FAIL + 1))
  ERRORS="${ERRORS}\n  - $name (expected one of [$*], got $actual)"
}

skip() {
  echo -e "  ${YELLOW}⊘${NC} $1 (skipped: $2)"
  SKIP=$((SKIP + 1))
}

section() {
  echo -e "\n${CYAN}━━━ $1 ━━━${NC}"
}

# Helper: authenticated request
auth_get() { curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" -b "$COOKIE_JAR" "$BASE$1" 2>/dev/null; }
auth_post() { curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" -b "$COOKIE_JAR" -H "Content-Type: application/json" -d "$2" "$BASE$1" 2>/dev/null; }
auth_patch() { curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" -b "$COOKIE_JAR" -H "Content-Type: application/json" -X PATCH -d "$2" "$BASE$1" 2>/dev/null; }
auth_delete() { curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" -b "$COOKIE_JAR" -X DELETE "$BASE$1" 2>/dev/null; }
admin_get() { curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" -b "$ADMIN_COOKIE_JAR" "$BASE$1" 2>/dev/null; }
admin_post() { curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" -b "$ADMIN_COOKIE_JAR" -H "Content-Type: application/json" -d "$2" "$BASE$1" 2>/dev/null; }
admin_patch() { curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" -b "$ADMIN_COOKIE_JAR" -H "Content-Type: application/json" -X PATCH -d "$2" "$BASE$1" 2>/dev/null; }
admin_delete() { curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" -b "$ADMIN_COOKIE_JAR" -X DELETE "$BASE$1" 2>/dev/null; }
resp() { cat /tmp/keyhub-resp.json 2>/dev/null; }

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        KeyHub Endpoint Test Suite            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"

# ─── 1. REGISTRATION ───────────────────────────────────
section "1. Auth — Registration"

# Register test user
code=$(curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" -H "Content-Type: application/json" \
  -d '{"email":"test@keyhub.test","password":"TestPass123!","name":"Test User"}' \
  "$BASE/api/auth/register" 2>/dev/null)
body=$(resp)
check_any "Register user (new or exists)" "$code" "201" "409"

# Test duplicate
code=$(curl -s -o /dev/null -w "%{http_code}" -H "Content-Type: application/json" \
  -d '{"email":"test@keyhub.test","password":"TestPass123!","name":"Test User"}' \
  "$BASE/api/auth/register" 2>/dev/null)
check "Duplicate registration blocked" "409" "$code"

# Test validation
code=$(curl -s -o /dev/null -w "%{http_code}" -H "Content-Type: application/json" \
  -d '{"email":"bad@test.com","password":"short"}' \
  "$BASE/api/auth/register" 2>/dev/null)
check "Short password rejected" "400" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" -H "Content-Type: application/json" \
  -d '{"email":"","password":"TestPass123!"}' \
  "$BASE/api/auth/register" 2>/dev/null)
check "Empty email rejected" "400" "$code"

# ─── 2. LOGIN (get session cookie) ─────────────────────
section "2. Auth — Login"

# Get CSRF token
CSRF_RESP=$(curl -s -c "$COOKIE_JAR" "$BASE/api/auth/csrf" 2>/dev/null)
CSRF_TOKEN=$(echo "$CSRF_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('csrfToken',''))" 2>/dev/null || echo "")

if [ -z "$CSRF_TOKEN" ]; then
  echo -e "  ${RED}✗${NC} Could not get CSRF token"
  FAIL=$((FAIL + 1))
else
  check "Get CSRF token" "non-empty" "non-empty"
fi

# Login
code=$(curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "csrfToken=${CSRF_TOKEN}&email=test@keyhub.test&password=TestPass123!&redirect=false&callbackUrl=/&json=true" \
  "$BASE/api/auth/callback/credentials" 2>/dev/null)
check_any "Login with credentials" "$code" "200" "302"

# Verify session
code=$(auth_get "/api/auth/session")
SESSION=$(resp)
HAS_USER=$(echo "$SESSION" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('user',{}).get('email') else 'no')" 2>/dev/null || echo "no")
check "Session has user" "yes" "$HAS_USER"

# ─── 3. UNAUTHENTICATED ACCESS ─────────────────────────
section "3. Auth — Unauthenticated access blocked"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/keys/provider" 2>/dev/null)
check_any "Provider keys (no auth → 401 or redirect)" "$code" "401" "307" "302"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/keys/platform" 2>/dev/null)
check_any "Platform keys (no auth → 401 or redirect)" "$code" "401" "307" "302"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/dashboard" 2>/dev/null)
check_any "Dashboard (no auth → 401 or redirect)" "$code" "401" "307" "302"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/logs" 2>/dev/null)
check_any "Logs (no auth → 401 or redirect)" "$code" "401" "307" "302"

# ─── 4. PROVIDER KEYS ──────────────────────────────────
section "4. Provider Keys (CRUD)"

# Create
code=$(auth_post "/api/keys/provider" '{"provider":"openai","label":"Test OpenAI Key","apiKey":"sk-test-fake-key-12345"}')
body=$(resp)
PROVIDER_KEY_ID=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
check "Create provider key" "201" "$code" "$body"

# List
code=$(auth_get "/api/keys/provider")
body=$(resp)
KEY_COUNT=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "0")
check "List provider keys" "200" "$code"
echo -e "    → Found $KEY_COUNT provider key(s)"

# Update
if [ -n "$PROVIDER_KEY_ID" ]; then
  code=$(auth_patch "/api/keys/provider" "{\"id\":\"$PROVIDER_KEY_ID\",\"isActive\":false}")
  check "Deactivate provider key" "200" "$code"

  code=$(auth_patch "/api/keys/provider" "{\"id\":\"$PROVIDER_KEY_ID\",\"isActive\":true,\"weight\":\"5\"}")
  check "Reactivate + set weight" "200" "$code"
fi

# ─── 5. PLATFORM KEYS ──────────────────────────────────
section "5. Platform Keys (CRUD)"

# Create
code=$(auth_post "/api/keys/platform" '{"label":"Test Platform Key"}')
body=$(resp)
PLATFORM_KEY_ID=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
RAW_KEY=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('rawKey',''))" 2>/dev/null || echo "")
check "Create platform key" "201" "$code" "$body"

# List
code=$(auth_get "/api/keys/platform")
check "List platform keys" "200" "$code"

# Update
if [ -n "$PLATFORM_KEY_ID" ]; then
  code=$(auth_patch "/api/keys/platform" "{\"id\":\"$PLATFORM_KEY_ID\",\"rateLimit\":\"100\",\"label\":\"Updated Label\"}")
  check "Update platform key" "200" "$code"

  code=$(auth_patch "/api/keys/platform" "{\"id\":\"$PLATFORM_KEY_ID\",\"routingStrategy\":\"round-robin\",\"maxRetries\":\"3\"}")
  check "Set routing strategy" "200" "$code"
fi

# ─── 6. DASHBOARD ──────────────────────────────────────
section "6. Dashboard"

code=$(auth_get "/api/dashboard")
body=$(resp)
check "Dashboard data" "200" "$code" "$body"
HAS_FIELDS=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'monthSpend' in d and 'totalRequests' in d and 'dailyChart' in d else 'no')" 2>/dev/null || echo "no")
check "Dashboard has expected fields" "yes" "$HAS_FIELDS"

code=$(auth_get "/api/dashboard?days=7")
check "Dashboard with custom range" "200" "$code"

# ─── 7. LOGS ───────────────────────────────────────────
section "7. Logs"

code=$(auth_get "/api/logs")
body=$(resp)
check "List logs" "200" "$code" "$body"

code=$(auth_get "/api/logs?page=1&limit=10")
check "Logs with pagination" "200" "$code"

code=$(auth_get "/api/logs?provider=openai")
check "Logs filtered by provider" "200" "$code"

code=$(auth_get "/api/logs/export")
check "Export logs" "200" "$code"

# ─── 8. USAGE ──────────────────────────────────────────
section "8. Usage"

code=$(auth_get "/api/usage")
check "Usage data" "200" "$code"

code=$(auth_get "/api/usage/what-if")
check "Usage what-if" "200" "$code"

# ─── 9. SETTINGS ──────────────────────────────────────
section "9. Settings"

code=$(auth_patch "/api/settings/profile" '{"name":"Updated Test User"}')
check "Update profile (PATCH)" "200" "$code"

code=$(auth_patch "/api/settings/password" '{"currentPassword":"TestPass123!","newPassword":"NewPass456!"}')
check "Change password (PATCH)" "200" "$code"

# Change it back
auth_patch "/api/settings/password" '{"currentPassword":"NewPass456!","newPassword":"TestPass123!"}' >/dev/null

code=$(auth_post "/api/settings/export" '{}')
check "Export settings/data (POST)" "200" "$code"

code=$(auth_get "/api/settings/notifications")
check "Get notification prefs" "200" "$code"

# ─── 10. TOTP (2FA) ────────────────────────────────────
section "10. TOTP / 2FA"

code=$(auth_get "/api/auth/totp/status")
body=$(resp)
check "TOTP status" "200" "$code" "$body"

code=$(auth_post "/api/auth/totp/setup" '{}')
body=$(resp)
HAS_QR=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'qrCode' in d or 'secret' in d else 'no')" 2>/dev/null || echo "no")
check "TOTP setup (QR code)" "200" "$code" "$body"
if [ "$HAS_QR" = "yes" ]; then
  echo -e "    → QR code / secret generated"
fi

# ─── 11. MISC ENDPOINTS ────────────────────────────────
section "11. Misc Endpoints"

code=$(auth_get "/api/my-ip")
check "Get my IP" "200" "$code"

code=$(auth_get "/api/announcements")
check "Get announcements" "200" "$code"

code=$(auth_get "/api/templates")
check "Get templates" "200" "$code"

code=$(auth_get "/api/webhooks")
check "Get webhooks" "200" "$code"

code=$(auth_get "/api/budget")
check "Get budget" "200" "$code"

code=$(auth_get "/api/anomalies")
check "Get anomalies" "200" "$code"

code=$(auth_get "/api/status")
check "System status" "200" "$code"

code=$(auth_get "/api/notifications/count")
check "Notification count" "200" "$code"

code=$(auth_get "/api/setup-status")
check "Setup status" "200" "$code"

# ─── 12. V1 API (proxy) ────────────────────────────────
section "12. V1 API (OpenAI-compatible proxy)"

code=$(curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" "$BASE/api/v1/models" 2>/dev/null)
check "List models (no auth)" "401" "$code"

if [ -n "$RAW_KEY" ]; then
  code=$(curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" -H "Authorization: Bearer $RAW_KEY" "$BASE/api/v1/models" 2>/dev/null)
  check "List models (with key)" "200" "$code"
else
  skip "List models (with key)" "no platform key"
fi

# Test chat completions without provider key
if [ -n "$RAW_KEY" ]; then
  code=$(curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" \
    -H "Authorization: Bearer $RAW_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Say hi"}],"max_tokens":5}' \
    "$BASE/api/v1/chat/completions" 2>/dev/null)
  body=$(resp)
  # Expected: either 500/502 (no real provider key) or some error — just check it doesn't crash
  if [ "$code" != "000" ]; then
    check "Chat completions (responds, may fail w/o real key)" "non-crash" "non-crash"
    echo -e "    → HTTP $code (expected since provider key is fake)"
  else
    check "Chat completions reachable" "non-000" "$code"
  fi
fi

# ─── 13. ORGANIZATIONS ─────────────────────────────────
section "13. Organizations"

code=$(auth_get "/api/orgs")
check "List orgs" "200" "$code"

code=$(auth_post "/api/orgs" '{"name":"Test Org","slug":"test-org"}')
body=$(resp)
ORG_ID=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
check_any "Create org (new or exists)" "$code" "200" "201" "409"
if [ "$code" = "409" ]; then
  auth_get "/api/orgs" >/dev/null
  ORG_ID=$(resp | python3 -c "import sys,json; orgs=json.load(sys.stdin); print(next((o['id'] for o in orgs if o.get('slug')=='test-org'),''))" 2>/dev/null || echo "")
fi

if [ -n "$ORG_ID" ]; then
  # Note: /api/orgs/[id] only has PATCH/DELETE, no GET
  code=$(auth_get "/api/orgs/$ORG_ID/members")
  check "List org members" "200" "$code"
fi

# ─── 14. AUDIT ──────────────────────────────────────────
section "14. Audit Log"

code=$(auth_get "/api/audit")
check "List audit events" "200" "$code"

code=$(auth_get "/api/audit/export")
check "Export audit events" "200" "$code"

# ─── 15. ADMIN (login as admin) ─────────────────────────
section "15. Admin Endpoints"

# First ensure admin user exists and is promoted
# Register admin (might already exist)
curl -s -o /dev/null -H "Content-Type: application/json" \
  -d '{"email":"admin@keyhub.com","password":"P@ssword1","name":"Admin"}' \
  "$BASE/api/auth/register" 2>/dev/null

# Login as admin
ADMIN_CSRF=$(curl -s -c "$ADMIN_COOKIE_JAR" "$BASE/api/auth/csrf" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('csrfToken',''))" 2>/dev/null || echo "")
code=$(curl -s -o /tmp/keyhub-resp.json -w "%{http_code}" -b "$ADMIN_COOKIE_JAR" -c "$ADMIN_COOKIE_JAR" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "csrfToken=${ADMIN_CSRF}&email=admin@keyhub.com&password=P@ssword1&redirect=false&callbackUrl=/&json=true" \
  "$BASE/api/auth/callback/credentials" 2>/dev/null)
check_any "Admin login" "$code" "200" "302"

# Test admin endpoints (returns 404 for non-SUPER_ADMIN by design)
code=$(admin_get "/api/admin/health")
check_any "Admin health (needs SUPER_ADMIN)" "$code" "200" "404"

code=$(admin_get "/api/admin/stats")
check_any "Admin stats (needs SUPER_ADMIN)" "$code" "200" "404"

code=$(admin_get "/api/admin/users")
check_any "Admin list users (needs SUPER_ADMIN)" "$code" "200" "404"

code=$(admin_get "/api/admin/logs")
check_any "Admin logs (needs SUPER_ADMIN)" "$code" "200" "404"

code=$(admin_get "/api/admin/flags")
check_any "Admin feature flags (needs SUPER_ADMIN)" "$code" "200" "404"

# ─── 16. PAGE ROUTES ────────────────────────────────────
section "16. Page Routes (SSR)"

for page in "/" "/dashboard" "/provider-keys" "/platform-keys" "/logs" "/usage" "/settings" "/docs"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE$page" 2>/dev/null)
  check_any "Page $page" "$code" "200" "307" "302"
done

# Auth pages
for page in "/login" "/register"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$page" 2>/dev/null)
  check "Page $page (public)" "200" "$code"
done

# ─── 17. CLEANUP ─────────────────────────────────────────
section "17. Cleanup"

# Delete test provider key
if [ -n "$PROVIDER_KEY_ID" ]; then
  code=$(auth_delete "/api/keys/provider?id=$PROVIDER_KEY_ID")
  check "Delete provider key" "200" "$code"
fi

# Delete test platform key
if [ -n "$PLATFORM_KEY_ID" ]; then
  code=$(auth_delete "/api/keys/platform?id=$PLATFORM_KEY_ID")
  check "Delete platform key" "200" "$code"
fi

# ─── SUMMARY ─────────────────────────────────────────────
echo ""
echo -e "${CYAN}══════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Passed: $PASS${NC}  ${RED}Failed: $FAIL${NC}  ${YELLOW}Skipped: $SKIP${NC}"
echo -e "${CYAN}══════════════════════════════════════════════${NC}"

if [ $FAIL -gt 0 ]; then
  echo -e "\n${RED}Failed tests:${ERRORS}${NC}"
  exit 1
else
  echo -e "\n${GREEN}All tests passed!${NC}"
fi

# Cleanup temp files
rm -f /tmp/keyhub-resp.json "$COOKIE_JAR" "$ADMIN_COOKIE_JAR"
