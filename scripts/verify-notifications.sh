#!/usr/bin/env bash
# Verify in-app notifications API without a browser.
# Usage:
#   ./scripts/verify-notifications.sh
#   API_URL=http://localhost:3000 EMAIL=you@example.com PASSWORD='secret' ./scripts/verify-notifications.sh
#   API_URL=http://localhost:3000 TOKEN='eyJ...' ./scripts/verify-notifications.sh

set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
EMAIL="${EMAIL:-notif-test@example.com}"
PASSWORD="${PASSWORD:-Password123!}"

pass=0
fail=0

check() {
  local name="$1"
  local expected_code="$2"
  local actual_code="$3"
  local body="$4"

  if [[ "$actual_code" == "$expected_code" ]]; then
    echo "✓ $name (HTTP $actual_code)"
    echo "  $body"
    pass=$((pass + 1))
  else
    echo "✗ $name — expected HTTP $expected_code, got $actual_code"
    echo "  $body"
    fail=$((fail + 1))
  fi
  echo ""
}

if [[ -z "${TOKEN:-}" ]]; then
  echo "Logging in as $EMAIL ..."
  login_resp=$(curl -s -w "\n__HTTP__:%{http_code}" -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  login_code="${login_resp##*__HTTP__:}"
  login_body="${login_resp%__HTTP__:*}"
  TOKEN=$(echo "$login_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token') or d.get('accessToken') or '')" 2>/dev/null || true)
  if [[ -z "$TOKEN" ]]; then
    echo "Login failed (HTTP $login_code): $login_body"
    exit 1
  fi
  echo "Got token (${#TOKEN} chars)"
  echo ""
fi

auth=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

echo "=== 1. GET /notifications (list) ==="
resp=$(curl -s -w "\n__HTTP__:%{http_code}" "${auth[@]}" "$API_URL/notifications")
code="${resp##*__HTTP__:}"
body="${resp%__HTTP__:*}"
check "List notifications" "200" "$code" "$body"

echo "=== 2. PATCH /notifications/read-all ==="
resp=$(curl -s -w "\n__HTTP__:%{http_code}" -X PATCH "${auth[@]}" "$API_URL/notifications/read-all")
code="${resp##*__HTTP__:}"
body="${resp%__HTTP__:*}"
check "Mark all read" "200" "$code" "$body"

echo "=== 3. PATCH /notifications/999/read (missing id) ==="
resp=$(curl -s -w "\n__HTTP__:%{http_code}" -X PATCH "${auth[@]}" "$API_URL/notifications/999/read")
code="${resp##*__HTTP__:}"
body="${resp%__HTTP__:*}"
check "Mark one (not found)" "200" "$code" "$body"

echo "=== Summary ==="
echo "Passed: $pass  Failed: $fail"
echo ""
echo "Notes:"
echo "  • Login returns { token, refreshToken, user } — use .token (not .accessToken)."
echo "  • List response is paginated: { data: [...], pagination: {...} }."
echo "  • Notifications are persisted in PostgreSQL (Notification table)."
echo "  • Order created + new message emit in-app rows automatically."

[[ "$fail" -eq 0 ]]
