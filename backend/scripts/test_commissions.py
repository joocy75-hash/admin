"""Integration test for commission system: policies, overrides, webhooks, ledger."""

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

# ─── Create test agents (if not exist) ────────────────────────────
print("\n2. Setup test agents")
agents = {}
hierarchy = [
    ("comm_admin01", "admin", "CMA001", None),
    ("comm_teacher01", "teacher", "CMT001", "comm_admin01"),
    ("comm_agent01", "agent", "CMA101", "comm_teacher01"),
]
for username, role, code, parent_name in hierarchy:
    parent_id = agents.get(parent_name, {}).get("id")
    s, d = api("POST", "/agents", {
        "username": username,
        "password": "test1234",
        "role": role,
        "agent_code": code,
        "parent_id": parent_id,
    }, TOKEN)
    if s == 201:
        agents[username] = d
        check(f"Create {username} -> {s}", True)
    elif s == 400 and "already exists" in d.get("detail", ""):
        # Fetch existing
        s2, d2 = api("GET", f"/agents?search={username}", token=TOKEN)
        if s2 == 200 and d2["items"]:
            agents[username] = d2["items"][0]
            check(f"Reuse existing {username}", True)
    else:
        check(f"Create {username} -> {s} {d}", False)

# ─── Commission Policies ──────────────────────────────────────────
print("\n3. Create commission policies")

# Rolling policy for casino
s, d = api("POST", "/commissions/policies", {
    "name": "Casino Rolling",
    "type": "rolling",
    "level_rates": {"1": 0.5, "2": 0.3, "3": 0.1},
    "game_category": "casino",
    "priority": 10,
}, TOKEN)
check(f"Create rolling policy -> {s}", s == 201)
rolling_policy_id = d.get("id")

# Losing policy for casino
s, d = api("POST", "/commissions/policies", {
    "name": "Casino Losing",
    "type": "losing",
    "level_rates": {"1": 5.0, "2": 3.0, "3": 1.0},
    "game_category": "casino",
    "priority": 10,
}, TOKEN)
check(f"Create losing policy -> {s}", s == 201)
losing_policy_id = d.get("id")

# Generic rolling (no category)
s, d = api("POST", "/commissions/policies", {
    "name": "Default Rolling",
    "type": "rolling",
    "level_rates": {"1": 0.3, "2": 0.2, "3": 0.05},
    "priority": 0,
}, TOKEN)
check(f"Create generic rolling -> {s}", s == 201)

print("\n4. List policies")
s, d = api("GET", "/commissions/policies?type=rolling", token=TOKEN)
check(f"List rolling policies -> {d.get('total', 0)} found", s == 200 and d["total"] >= 2)

s, d = api("GET", "/commissions/policies?game_category=casino", token=TOKEN)
check(f"List casino policies -> {d.get('total', 0)} found", s == 200 and d["total"] >= 2)

print("\n5. Get single policy")
s, d = api("GET", f"/commissions/policies/{rolling_policy_id}", token=TOKEN)
check(f"Get rolling policy -> type={d.get('type')}", s == 200 and d["type"] == "rolling")

print("\n6. Update policy")
s, d = api("PUT", f"/commissions/policies/{rolling_policy_id}", {
    "level_rates": {"1": 0.6, "2": 0.35, "3": 0.15},
}, TOKEN)
check(f"Update rates -> L1={d.get('level_rates', {}).get('1')}", s == 200 and d["level_rates"]["1"] == 0.6)

# Restore original
api("PUT", f"/commissions/policies/{rolling_policy_id}", {
    "level_rates": {"1": 0.5, "2": 0.3, "3": 0.1},
}, TOKEN)

# ─── Overrides ────────────────────────────────────────────────────
print("\n7. Agent overrides")
agent01_id = agents.get("comm_agent01", {}).get("id")

if agent01_id and rolling_policy_id:
    s, d = api("POST", "/commissions/overrides", {
        "admin_user_id": agent01_id,
        "policy_id": rolling_policy_id,
        "custom_rates": {"1": 0.8, "2": 0.5, "3": 0.2},
    }, TOKEN)
    check(f"Create override -> {s}", s == 201)
    override_id = d.get("id")

    s, d = api("GET", f"/commissions/overrides?agent_id={agent01_id}", token=TOKEN)
    check(f"List overrides for agent -> {len(d)} found", s == 200 and len(d) >= 1)

    # Delete override so webhook test uses policy defaults
    if override_id:
        api("DELETE", f"/commissions/overrides/{override_id}", token=TOKEN)

# ─── Webhook: Bet (Rolling) ───────────────────────────────────────
print("\n8. Webhook: bet event (rolling commission)")
if agent01_id:
    s, d = api("POST", "/commissions/webhook/bet", {
        "user_id": 9001,
        "agent_id": agent01_id,
        "game_category": "casino",
        "game_code": "baccarat-01",
        "round_id": "TEST-ROUND-001",
        "bet_amount": 100000,
    })
    check(f"Bet webhook -> entries={d.get('entries')}", s == 201 and d.get("entries", 0) >= 1)

    # Duplicate check
    s2, d2 = api("POST", "/commissions/webhook/bet", {
        "user_id": 9001,
        "agent_id": agent01_id,
        "game_category": "casino",
        "game_code": "baccarat-01",
        "round_id": "TEST-ROUND-001",
        "bet_amount": 100000,
    })
    check(f"Duplicate bet -> entries={d2.get('entries', -1)}", s2 == 201 and d2.get("entries") == 0)

# ─── Webhook: Round Result (Losing) ──────────────────────────────
print("\n9. Webhook: round result (losing commission)")
if agent01_id:
    s, d = api("POST", "/commissions/webhook/round-result", {
        "user_id": 9001,
        "agent_id": agent01_id,
        "game_category": "casino",
        "game_code": "baccarat-01",
        "round_id": "TEST-ROUND-002",
        "bet_amount": 100000,
        "win_amount": 20000,
        "result": "lose",
    })
    check(f"Losing webhook -> entries={d.get('entries')}", s == 201 and d.get("entries", 0) >= 1)

    # Win result -> no losing commission
    s, d = api("POST", "/commissions/webhook/round-result", {
        "user_id": 9001,
        "agent_id": agent01_id,
        "game_category": "casino",
        "game_code": "baccarat-01",
        "round_id": "TEST-ROUND-003",
        "bet_amount": 50000,
        "win_amount": 120000,
        "result": "win",
    })
    check(f"Win result -> no losing commission entries={d.get('entries')}", s == 201 and d.get("entries") == 0)

# ─── Ledger ───────────────────────────────────────────────────────
print("\n10. Commission ledger")
s, d = api("GET", "/commissions/ledger?page_size=50", token=TOKEN)
check(f"Ledger list -> {d.get('total', 0)} entries", s == 200 and d["total"] >= 1)
check(f"Total commission -> {d.get('total_commission')}", d.get("total_commission") is not None)

if agent01_id:
    s, d = api("GET", f"/commissions/ledger?agent_id={agent01_id}&type=rolling", token=TOKEN)
    check(f"Ledger filter agent+rolling -> {d.get('total', 0)} entries", s == 200)

print("\n11. Ledger summary")
s, d = api("GET", "/commissions/ledger/summary", token=TOKEN)
check(f"Summary -> {len(d)} types", s == 200 and len(d) >= 1)
for item in d:
    print(f"    {item['type']}: {item['total_amount']} ({item['count']} entries)")

# ─── Summary ──────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
if failed == 0:
    print("All tests passed!")
else:
    print(f"{failed} test(s) failed")
