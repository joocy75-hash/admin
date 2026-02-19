"""Integration test for user management and finance (deposit/withdrawal/adjustment)."""

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
print("\n1. Login")
s, d = api("POST", "/auth/login", {"username": "superadmin", "password": "admin1234!"})
check(f"Login -> {s}", s == 200)
TOKEN = d["access_token"]

# ─── Find/Create test agent ──────────────────────────────────────
print("\n2. Find test agent")
s, d = api("GET", "/agents?search=fin_agent01", token=TOKEN)
agent = d["items"][0] if s == 200 and d.get("items") else None
if not agent:
    s2, d2 = api("POST", "/agents", {
        "username": "fin_agent01",
        "password": "test1234",
        "role": "agent",
        "agent_code": "FIN01",
    }, TOKEN)
    if s2 == 201:
        agent = d2
check(f"Agent: {agent['username'] if agent else 'N/A'}", agent is not None)
AGENT_ID = agent["id"]

# ─── Create User ─────────────────────────────────────────────────
print("\n3. Create user")
s, d = api("POST", "/users", {
    "username": "test_player01",
    "real_name": "테스트유저",
    "phone": "010-1234-5678",
    "agent_id": AGENT_ID,
    "level": 1,
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    # Already exists, find it
    s3, d3 = api("GET", "/users?search=test_player01", token=TOKEN)
    if s3 == 200 and d3["items"]:
        d = d3["items"][0]
        s = 200
check(f"Create user -> {d.get('username')}", d.get("username") == "test_player01")
USER_ID = d["id"]

# ─── List Users ──────────────────────────────────────────────────
print("\n4. List users")
s, d = api("GET", f"/users?agent_id={AGENT_ID}", token=TOKEN)
check(f"List -> {d.get('total', 0)} users", s == 200 and d["total"] >= 1)

# ─── Get User ────────────────────────────────────────────────────
print("\n5. Get user detail")
s, d = api("GET", f"/users/{USER_ID}", token=TOKEN)
check(f"Get -> agent_username={d.get('agent_username')}", s == 200 and d.get("agent_username"))

# ─── Update User ─────────────────────────────────────────────────
print("\n6. Update user")
s, d = api("PUT", f"/users/{USER_ID}", {"level": 5, "memo": "VIP 회원"}, TOKEN)
check(f"Update -> level={d.get('level')}", s == 200 and d.get("level") == 5)

# ─── Search User ─────────────────────────────────────────────────
print("\n7. Search user")
s, d = api("GET", "/users?search=테스트", token=TOKEN)
check(f"Search -> {d.get('total', 0)} results", s == 200 and d["total"] >= 1)

# ─── Deposit ─────────────────────────────────────────────────────
print("\n8. Create deposit")
s, d = api("POST", "/finance/deposit", {
    "user_id": USER_ID,
    "amount": 500000,
    "memo": "Test deposit",
}, TOKEN)
check(f"Deposit -> status={d.get('status')}", s == 201 and d.get("status") == "pending")
DEPOSIT_TX_ID = d.get("id")

# ─── Approve Deposit ─────────────────────────────────────────────
print("\n9. Approve deposit")
s, d = api("POST", f"/finance/transactions/{DEPOSIT_TX_ID}/approve", {}, TOKEN)
check(f"Approve -> balance_after={d.get('balance_after')}", s == 200 and float(d.get("balance_after", 0)) >= 500000)

# ─── Verify user balance ─────────────────────────────────────────
print("\n10. Verify user balance after deposit")
s, d = api("GET", f"/users/{USER_ID}", token=TOKEN)
check(f"Balance = {d.get('balance')}", s == 200 and float(d.get("balance", 0)) >= 500000)

# ─── Withdrawal ──────────────────────────────────────────────────
print("\n11. Create withdrawal")
s, d = api("POST", "/finance/withdrawal", {
    "user_id": USER_ID,
    "amount": 100000,
    "memo": "Test withdrawal",
}, TOKEN)
check(f"Withdrawal -> status={d.get('status')}", s == 201 and d.get("status") == "pending")
WITHDRAWAL_TX_ID = d.get("id")

# ─── Reject Withdrawal ──────────────────────────────────────────
print("\n12. Reject withdrawal")
s, d = api("POST", f"/finance/transactions/{WITHDRAWAL_TX_ID}/reject", {"memo": "Rejected for test"}, TOKEN)
check(f"Reject -> status={d.get('status')}", s == 200 and d.get("status") == "rejected")

# ─── Balance unchanged after rejection ───────────────────────────
print("\n13. Balance unchanged after rejection")
s, d = api("GET", f"/users/{USER_ID}", token=TOKEN)
check(f"Balance still >= 500000: {d.get('balance')}", s == 200 and float(d.get("balance", 0)) >= 500000)

# ─── Create and approve withdrawal ───────────────────────────────
print("\n14. Create and approve withdrawal")
s, d = api("POST", "/finance/withdrawal", {"user_id": USER_ID, "amount": 200000}, TOKEN)
check(f"Withdrawal created -> {s}", s == 201)
WD_ID = d.get("id")
s, d = api("POST", f"/finance/transactions/{WD_ID}/approve", {}, TOKEN)
check(f"Approved -> balance_after={d.get('balance_after')}", s == 200)

# ─── Manual Adjustment (credit) ──────────────────────────────────
print("\n15. Manual adjustment (credit)")
s, d = api("POST", "/finance/adjustment", {
    "user_id": USER_ID,
    "action": "credit",
    "amount": 50000,
    "memo": "Bonus credit",
}, TOKEN)
check(f"Adjustment credit -> status={d.get('status')}", s == 201 and d.get("status") == "approved")

# ─── Manual Adjustment (debit) ───────────────────────────────────
print("\n16. Manual adjustment (debit)")
s, d = api("POST", "/finance/adjustment", {
    "user_id": USER_ID,
    "action": "debit",
    "amount": 30000,
    "memo": "Deduction",
}, TOKEN)
check(f"Adjustment debit -> status={d.get('status')}", s == 201 and d.get("status") == "approved")

# ─── Transaction List ────────────────────────────────────────────
print("\n17. Transaction list")
s, d = api("GET", f"/finance/transactions?user_id={USER_ID}", token=TOKEN)
check(f"List -> {d.get('total', 0)} transactions", s == 200 and d["total"] >= 4)

# ─── Double-approve prevention ───────────────────────────────────
print("\n18. Cannot double-approve")
s, d = api("POST", f"/finance/transactions/{DEPOSIT_TX_ID}/approve", {}, TOKEN)
check(f"Double approve rejected -> {d.get('detail', '')}", s == 400)

# ─── Insufficient balance check ──────────────────────────────────
print("\n19. Insufficient balance check")
s, d = api("POST", "/finance/withdrawal", {
    "user_id": USER_ID,
    "amount": 99999999,
}, TOKEN)
check(f"Insufficient -> {d.get('detail', '')}", s == 400)

# ─── Summary ─────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
if failed == 0:
    print("All tests passed!")
else:
    print(f"{failed} test(s) failed")
