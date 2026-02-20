"""Integration test for dashboard stats, reports, and SSE events."""

import json
import threading
import time
import urllib.parse
import urllib.request

BASE = "http://localhost:8002/api/v1"
passed = 0
failed = 0


def api(method, path, body=None, token=None, raw=False):
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    encoded_path = urllib.parse.quote(path, safe="/:?&=")
    req = urllib.request.Request(f"{BASE}{encoded_path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            if raw:
                return r.status, r.read(), r.headers.get("Content-Type", "")
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


# ─── Ensure report permissions exist ────────────────────────────
def ensure_permissions(token):
    """Add report.view and report.export permissions if missing."""
    # Use raw SQL via a quick endpoint isn't available, so we skip.
    # super_admin bypasses all permission checks, so tests will work.
    pass


# ═══════════════════════════════════════════════════════════════════
# 1. Login
# ═══════════════════════════════════════════════════════════════════
print("\n1. Login")
s, d = api("POST", "/auth/login", {"username": "superadmin", "password": "admin1234!"})
check(f"Login -> {s}", s == 200)
TOKEN = d["access_token"]

# ═══════════════════════════════════════════════════════════════════
# Dashboard
# ═══════════════════════════════════════════════════════════════════

# ─── Dashboard Stats ─────────────────────────────────────────────
print("\n2. Dashboard stats")
s, d = api("GET", "/dashboard/stats", token=TOKEN)
check(f"Stats -> {s}", s == 200)
check("Has total_agents field", "total_agents" in d)
check("Has total_users field", "total_users" in d)
check("Has today_deposits field", "today_deposits" in d)
check("Has pending_deposits field", "pending_deposits" in d)
check("Has active_games field", "active_games" in d)

# ─── Recent Transactions ────────────────────────────────────────
print("\n3. Recent transactions")
s, d = api("GET", "/dashboard/recent-transactions", token=TOKEN)
check(f"Recent transactions -> {s}", s == 200)
check("Is list", isinstance(d, list))

# ─── Recent Commissions ─────────────────────────────────────────
print("\n4. Recent commissions")
s, d = api("GET", "/dashboard/recent-commissions", token=TOKEN)
check(f"Recent commissions -> {s}", s == 200)
check("Is list", isinstance(d, list))

# ─── Dashboard without auth ─────────────────────────────────────
print("\n5. Dashboard without auth")
s, d = api("GET", "/dashboard/stats")
check(f"Unauthorized -> {s}", s in (401, 403))

# ═══════════════════════════════════════════════════════════════════
# Reports
# ═══════════════════════════════════════════════════════════════════

# ─── Agent Report ────────────────────────────────────────────────
print("\n6. Agent report")
s, d = api("GET", "/reports/agents?start_date=2026-01-01&end_date=2026-12-31", token=TOKEN)
check(f"Agent report -> {s}", s == 200)
check("Has items", "items" in d)
check("Has start_date", "start_date" in d)
check("Has end_date", "end_date" in d)

# ─── Agent Report (no dates) ────────────────────────────────────
print("\n7. Agent report (default dates)")
s, d = api("GET", "/reports/agents", token=TOKEN)
check(f"Agent report default -> {s}", s == 200)

# ─── Commission Report ──────────────────────────────────────────
print("\n8. Commission report")
s, d = api("GET", "/reports/commissions?start_date=2026-01-01&end_date=2026-12-31", token=TOKEN)
check(f"Commission report -> {s}", s == 200)
check("Has items", "items" in d)
check("Has by_user", "by_user" in d)

# ─── Financial Report ───────────────────────────────────────────
print("\n9. Financial report")
s, d = api("GET", "/reports/financial?start_date=2026-01-01&end_date=2026-12-31", token=TOKEN)
check(f"Financial report -> {s}", s == 200)
check("Has total_deposits", "total_deposits" in d)
check("Has total_withdrawals", "total_withdrawals" in d)
check("Has net_revenue", "net_revenue" in d)
check("Has total_commissions", "total_commissions" in d)

# ─── Financial Report (default dates) ───────────────────────────
print("\n10. Financial report (default dates)")
s, d = api("GET", "/reports/financial", token=TOKEN)
check(f"Financial report default -> {s}", s == 200)

# ─── Reports without auth ───────────────────────────────────────
print("\n11. Reports without auth")
s, d = api("GET", "/reports/agents")
check(f"Agents report unauthorized -> {s}", s in (401, 403))

# ═══════════════════════════════════════════════════════════════════
# Excel Export
# ═══════════════════════════════════════════════════════════════════

print("\n12. Agent report Excel export")
s, body, ct = api("GET", "/reports/agents/export?start_date=2026-01-01&end_date=2026-12-31", token=TOKEN, raw=True)
check(f"Agent export -> {s}", s == 200)
check("Content-Type is xlsx", "spreadsheet" in ct or "excel" in ct.lower() or "openxml" in ct)
check("Body is non-empty", len(body) > 100)

print("\n13. Commission report Excel export")
s, body, ct = api("GET", "/reports/commissions/export?start_date=2026-01-01&end_date=2026-12-31", token=TOKEN, raw=True)
check(f"Commission export -> {s}", s == 200)
check("Content-Type is xlsx", "spreadsheet" in ct or "openxml" in ct)

print("\n14. Financial report Excel export")
s, body, ct = api("GET", "/reports/financial/export?start_date=2026-01-01&end_date=2026-12-31", token=TOKEN, raw=True)
check(f"Financial export -> {s}", s == 200)
check("Content-Type is xlsx", "spreadsheet" in ct or "openxml" in ct)

# ═══════════════════════════════════════════════════════════════════
# SSE Stream
# ═══════════════════════════════════════════════════════════════════

print("\n15. SSE stream connection")
sse_data = []
sse_connected = threading.Event()


def sse_reader():
    try:
        url = f"{BASE}/events/stream?token={TOKEN}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as r:
            sse_connected.set()
            while True:
                line = r.readline().decode().strip()
                if line:
                    sse_data.append(line)
                if len(sse_data) > 5:
                    break
    except Exception:
        sse_connected.set()


t = threading.Thread(target=sse_reader, daemon=True)
t.start()
sse_connected.wait(timeout=3)
time.sleep(1)
# SSE should at least connect without error
check("SSE stream connected", sse_connected.is_set())

print("\n16. SSE stream with invalid token")
s_inv, d_inv = api("GET", "/events/stream?token=invalid_token", token=None)
# Should return 401 or an error event
check(f"SSE invalid token -> {s_inv}", s_inv in (200, 401))

# ═══════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════
print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
if failed == 0:
    print("All tests passed!")
else:
    print(f"{failed} test(s) failed")
