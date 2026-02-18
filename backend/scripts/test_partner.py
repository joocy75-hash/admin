"""Integration test for partner dashboard endpoints."""

import json
import urllib.parse
import urllib.request

BASE = "http://localhost:8002/api/v1"
passed = 0
failed = 0


def api(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    encoded_path = urllib.parse.quote(path, safe="/:?&=")
    req = urllib.request.Request(f"{BASE}{encoded_path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            if r.status == 204:
                return r.status, {}
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        try:
            return e.code, json.loads(body_text)
        except Exception:
            return e.code, {"raw": body_text}


def check(name, condition):
    global passed, failed
    if condition:
        passed += 1
        print(f"  OK {name}")
    else:
        failed += 1
        print(f"  FAIL {name}")


# ─── Login ────────────────────────────────────────────────────────
print("\n1. Login as superadmin")
s, d = api("POST", "/auth/login", {"username": "superadmin", "password": "admin1234!"})
check(f"Login -> {s}", s == 200)
TOKEN = d["access_token"]

# ═══════════════════════════════════════════════════════════════════
# Partner Dashboard
# ═══════════════════════════════════════════════════════════════════

print("\n2. GET /partner/dashboard")
s, d = api("GET", "/partner/dashboard", token=TOKEN)
check(f"Dashboard stats -> {s}", s == 200)
check("Has total_sub_agents", "total_sub_agents" in d)
check("Has total_commission", "total_commission" in d)
check("Has month_bet_amount", "month_bet_amount" in d)
check("Has total_sub_users", "total_sub_users" in d)

# ═══════════════════════════════════════════════════════════════════
# Partner Tree
# ═══════════════════════════════════════════════════════════════════

print("\n3. GET /partner/tree")
s, d = api("GET", "/partner/tree", token=TOKEN)
check(f"Tree -> {s}", s == 200)
check("Tree is list", isinstance(d, list))
if len(d) > 0:
    check("First node has username", "username" in d[0])
    check("First node has role", "role" in d[0])
    check("First node has level", "level" in d[0])
else:
    check("Tree has self node", len(d) >= 1)

# ═══════════════════════════════════════════════════════════════════
# Partner Users
# ═══════════════════════════════════════════════════════════════════

print("\n4. GET /partner/users")
s, d = api("GET", "/partner/users", token=TOKEN)
check(f"Users list -> {s}", s == 200)
check("Has items", "items" in d)
check("Has total", "total" in d)
check("Has page", "page" in d)

print("\n5. GET /partner/users with filters")
s, d = api("GET", "/partner/users?page=1&page_size=5", token=TOKEN)
check(f"Users filtered -> {s}", s == 200)
check("Page size respected", d.get("page_size") == 5)

# ═══════════════════════════════════════════════════════════════════
# Partner Commissions
# ═══════════════════════════════════════════════════════════════════

print("\n6. GET /partner/commissions")
s, d = api("GET", "/partner/commissions", token=TOKEN)
check(f"Commissions -> {s}", s == 200)
check("Has items", "items" in d)
check("Has total", "total" in d)
check("Has total_commission", "total_commission" in d)

print("\n7. GET /partner/commissions with type filter")
s, d = api("GET", "/partner/commissions?type=rolling", token=TOKEN)
check(f"Rolling filter -> {s}", s == 200)

print("\n8. GET /partner/commissions with date filter")
s, d = api("GET", "/partner/commissions?date_from=2026-01-01&date_to=2026-12-31", token=TOKEN)
check(f"Date filter -> {s}", s == 200)

# ═══════════════════════════════════════════════════════════════════
# Partner Settlements
# ═══════════════════════════════════════════════════════════════════

print("\n9. GET /partner/settlements")
s, d = api("GET", "/partner/settlements", token=TOKEN)
check(f"Settlements -> {s}", s == 200)
check("Has items", "items" in d)
check("Has total", "total" in d)

print("\n10. GET /partner/settlements with status filter")
s, d = api("GET", "/partner/settlements?status=paid", token=TOKEN)
check(f"Paid filter -> {s}", s == 200)

# ═══════════════════════════════════════════════════════════════════
# Unauthorized access (no token)
# ═══════════════════════════════════════════════════════════════════

print("\n11. Unauthorized access")
s, d = api("GET", "/partner/dashboard")
check(f"No token -> {s}", s == 403 or s == 401)

# ─── Summary ─────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
if failed == 0:
    print("All tests passed!")
else:
    print(f"{failed} test(s) failed")
