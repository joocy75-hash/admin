"""Integration test for settlement system: preview, create, confirm, pay."""

import json
import urllib.request

BASE = "http://localhost:8002/api/v1"
passed = 0
failed = 0


def api(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
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
print("\n1. Login")
s, d = api("POST", "/auth/login", {"username": "superadmin", "password": "admin1234!"})
check(f"Login -> {s}", s == 200)
TOKEN = d["access_token"]

# ─── Find test agent ──────────────────────────────────────────────
print("\n2. Find test agent (comm_agent01 from Phase 5)")
s, d = api("GET", "/agents?search=comm_agent01", token=TOKEN)
agent01 = d["items"][0] if s == 200 and d.get("items") else None
if not agent01:
    # Create one if not found
    s2, d2 = api("POST", "/agents", {
        "username": "settle_agent01",
        "password": "test1234",
        "role": "agent",
        "agent_code": "STA001",
    }, TOKEN)
    if s2 == 201:
        agent01 = d2
check(f"Agent found: {agent01['username'] if agent01 else 'N/A'}", agent01 is not None)
AGENT_ID = agent01["id"]

# ─── Generate commissions via webhook ─────────────────────────────
print("\n3. Generate commissions for settlement")
for i in range(3):
    s, d = api("POST", "/commissions/webhook/bet", {
        "user_id": 9002,
        "agent_id": AGENT_ID,
        "game_category": "casino",
        "round_id": f"SETTLE-BET-{i+1:03d}",
        "bet_amount": 200000,
    })
    # May already exist from Phase 5 test

for i in range(2):
    s, d = api("POST", "/commissions/webhook/round-result", {
        "user_id": 9002,
        "agent_id": AGENT_ID,
        "game_category": "casino",
        "round_id": f"SETTLE-LOSS-{i+1:03d}",
        "bet_amount": 150000,
        "win_amount": 30000,
        "result": "lose",
    })

print("  Webhooks sent")

# ─── Preview ──────────────────────────────────────────────────────
print("\n4. Settlement preview")
s, d = api("GET", f"/settlements/preview?agent_id={AGENT_ID}&period_start=2026-01-01&period_end=2026-12-31", token=TOKEN)
check(f"Preview -> pending_entries={d.get('pending_entries')}", s == 200 and d.get("pending_entries", 0) > 0)
check(f"Preview gross_total={d.get('gross_total')}", float(d.get("gross_total", 0)) > 0)

# ─── Create settlement ────────────────────────────────────────────
print("\n5. Create settlement")
s, d = api("POST", "/settlements", {
    "agent_id": AGENT_ID,
    "period_start": "2026-01-01",
    "period_end": "2026-12-31",
    "memo": "Test settlement",
}, TOKEN)
check(f"Create -> status={d.get('status')}", s == 201 and d.get("status") == "draft")
SETTLEMENT_ID = d.get("id")

# ─── List settlements ─────────────────────────────────────────────
print("\n6. List settlements")
s, d = api("GET", f"/settlements?agent_id={AGENT_ID}", token=TOKEN)
check(f"List -> {d.get('total', 0)} settlements", s == 200 and d["total"] >= 1)

# ─── Get one ──────────────────────────────────────────────────────
print("\n7. Get single settlement")
s, d = api("GET", f"/settlements/{SETTLEMENT_ID}", token=TOKEN)
check(f"Get -> net_total={d.get('net_total')}", s == 200 and float(d.get("net_total", 0)) > 0)

# ─── Reject → re-create ──────────────────────────────────────────
print("\n8. Reject and re-create")
s, d = api("POST", f"/settlements/{SETTLEMENT_ID}/reject", {"memo": "Rejected for testing"}, TOKEN)
check(f"Reject -> status={d.get('status')}", s == 200 and d.get("status") == "rejected")

# Create again (entries should be unlinked and available)
s, d = api("POST", "/settlements", {
    "agent_id": AGENT_ID,
    "period_start": "2026-01-01",
    "period_end": "2026-12-31",
    "memo": "Re-created after reject",
}, TOKEN)
check(f"Re-create -> status={d.get('status')}", s == 201 and d.get("status") == "draft")
SETTLEMENT_ID = d.get("id")

# ─── Confirm ──────────────────────────────────────────────────────
print("\n9. Confirm settlement")
s, d = api("POST", f"/settlements/{SETTLEMENT_ID}/confirm", {}, TOKEN)
check(f"Confirm -> status={d.get('status')}", s == 200 and d.get("status") == "confirmed")
check(f"Confirmed by={d.get('confirmed_by_username')}", d.get("confirmed_by_username") == "superadmin")

# ─── Pay ──────────────────────────────────────────────────────────
print("\n10. Pay settlement")
net_total = float(d.get("net_total", 0))
s, d = api("POST", f"/settlements/{SETTLEMENT_ID}/pay", {}, TOKEN)
check(f"Pay -> status={d.get('status')}", s == 200 and d.get("status") == "paid")
check(f"Paid at set", d.get("paid_at") is not None)

# ─── Verify agent balance updated ─────────────────────────────────
print("\n11. Verify agent balance")
s, d = api("GET", f"/agents/{AGENT_ID}", token=TOKEN)
check(f"Agent balance={d.get('balance')}", s == 200 and float(d.get("balance", 0)) > 0)

# ─── Cannot double-pay ────────────────────────────────────────────
print("\n12. Cannot double-pay")
s, d = api("POST", f"/settlements/{SETTLEMENT_ID}/pay", {}, TOKEN)
check(f"Double pay rejected -> {d.get('detail', '')}", s == 400)

# ─── Summary ──────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
if failed == 0:
    print("All tests passed!")
else:
    print(f"{failed} test(s) failed")
