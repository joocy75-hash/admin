"""Integration test for connector endpoints: list, test, sync, webhook, status."""

import json
import urllib.parse
import urllib.request

BASE = "http://localhost:8002/api/v1"
passed = 0
failed = 0


def api(method, path, body=None, token=None, headers=None):
    data = json.dumps(body).encode() if body else None
    hdrs = {"Content-Type": "application/json"}
    if token:
        hdrs["Authorization"] = f"Bearer {token}"
    if headers:
        hdrs.update(headers)
    encoded_path = urllib.parse.quote(path, safe="/:?&=")
    req = urllib.request.Request(f"{BASE}{encoded_path}", data=data, headers=hdrs, method=method)
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


# ═══════════════════════════════════════════════════════════════════
# Ensure test providers exist
# ═══════════════════════════════════════════════════════════════════

print("\n2. Ensure casino provider exists")
s, d = api("POST", "/games/providers", {
    "name": "Evolution Gaming",
    "code": "EVO",
    "category": "casino",
    "api_url": "https://api.evolution.com",
    "api_key": "test-api-key-123",
    "description": "Live casino provider",
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    s2, d2 = api("GET", "/games/providers?search=EVO", token=TOKEN)
    if s2 == 200 and d2["items"]:
        d = d2["items"][0]
        s = 200
check(f"Casino provider ready -> {d.get('code')}", d.get("code") == "EVO")
CASINO_PROVIDER_ID = d["id"]

print("\n3. Ensure slot provider exists")
s, d = api("POST", "/games/providers", {
    "name": "Pragmatic Play",
    "code": "PP",
    "category": "slot",
    "api_url": "https://api.pragmaticplay.com",
    "api_key": "pp-api-key-456",
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    s2, d2 = api("GET", "/games/providers?search=PP", token=TOKEN)
    if s2 == 200 and d2["items"]:
        d = d2["items"][0]
        s = 200
check(f"Slot provider ready -> {d.get('code')}", d.get("code") == "PP")
SLOT_PROVIDER_ID = d["id"]

# Provider without API config
print("\n4. Ensure unconfigured provider exists")
s, d = api("POST", "/games/providers", {
    "name": "Test NoAPI Provider",
    "code": "NOAPI",
    "category": "casino",
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    s2, d2 = api("GET", "/games/providers?search=NOAPI", token=TOKEN)
    if s2 == 200 and d2["items"]:
        d = d2["items"][0]
        s = 200
check(f"NoAPI provider ready -> {d.get('code')}", d.get("code") == "NOAPI")
NOAPI_PROVIDER_ID = d["id"]


# ═══════════════════════════════════════════════════════════════════
# Connector List
# ═══════════════════════════════════════════════════════════════════

print("\n5. List all connectors")
s, d = api("GET", "/connectors", token=TOKEN)
check(f"List connectors -> {s}, count={len(d)}", s == 200 and isinstance(d, list) and len(d) >= 2)

print("\n6. Connector list has required fields")
if d:
    first = d[0]
    has_fields = all(k in first for k in ["provider_id", "name", "code", "category", "is_connected", "game_count"])
    check(f"Required fields present", has_fields)
else:
    check("Has items", False)


# ═══════════════════════════════════════════════════════════════════
# Test Connection
# ═══════════════════════════════════════════════════════════════════

print("\n7. Test connection (casino provider - external API unreachable)")
s, d = api("POST", f"/connectors/{CASINO_PROVIDER_ID}/test", token=TOKEN)
check(f"Test -> {s}, success={d.get('success')}", s == 200 and "success" in d and "latency_ms" in d)

print("\n8. Test connection (unconfigured provider)")
s, d = api("POST", f"/connectors/{NOAPI_PROVIDER_ID}/test", token=TOKEN)
check(f"No config -> success=False", s == 200 and d.get("success") is False)

print("\n9. Test connection (non-existent provider)")
s, d = api("POST", "/connectors/99999/test", token=TOKEN)
check(f"Not found -> {s}", s == 404)


# ═══════════════════════════════════════════════════════════════════
# Sync Games
# ═══════════════════════════════════════════════════════════════════

print("\n10. Sync games (casino - external API unreachable, expect 502)")
s, d = api("POST", f"/connectors/{CASINO_PROVIDER_ID}/sync-games", token=TOKEN)
check(f"Sync failed -> {s}", s == 502)

print("\n11. Sync games (unconfigured provider, expect 400)")
s, d = api("POST", f"/connectors/{NOAPI_PROVIDER_ID}/sync-games", token=TOKEN)
check(f"No config -> {s}", s == 400)

print("\n12. Sync games (non-existent provider)")
s, d = api("POST", "/connectors/99999/sync-games", token=TOKEN)
check(f"Not found -> {s}", s == 404)


# ═══════════════════════════════════════════════════════════════════
# Webhook
# ═══════════════════════════════════════════════════════════════════

print("\n13. Receive webhook (valid provider code)")
s, d = api("POST", "/connectors/webhook/EVO", {
    "event_type": "bet_placed",
    "data": {"round_id": "R001", "user_id": "U001", "amount": 10000},
    "timestamp": "2026-02-18T12:00:00Z",
})
check(f"Webhook received -> {s}, status={d.get('status')}", s == 200 and d.get("status") == "received")

print("\n14. Webhook (invalid provider code)")
s, d = api("POST", "/connectors/webhook/INVALID_CODE", {
    "event_type": "bet_placed",
    "data": {},
})
check(f"Provider not found -> {s}", s == 404)

print("\n15. Webhook with event_type check")
s, d = api("POST", "/connectors/webhook/EVO", {
    "event_type": "round_result",
    "data": {"round_id": "R002", "result": "win", "win_amount": 50000},
})
check(f"Event type -> {d.get('event_type')}", s == 200 and d.get("event_type") == "round_result")


# ═══════════════════════════════════════════════════════════════════
# Connector Status (detailed)
# ═══════════════════════════════════════════════════════════════════

print("\n16. Get connector status (casino)")
s, d = api("GET", f"/connectors/{CASINO_PROVIDER_ID}/status", token=TOKEN)
check(f"Status -> {s}, connected={d.get('is_connected')}", s == 200 and d.get("is_connected") is True)
check(f"Has game_count field", "game_count" in d)

print("\n17. Get connector status (unconfigured)")
s, d = api("GET", f"/connectors/{NOAPI_PROVIDER_ID}/status", token=TOKEN)
check(f"Not connected -> {d.get('is_connected')}", s == 200 and d.get("is_connected") is False)

print("\n18. Get connector status (non-existent)")
s, d = api("GET", "/connectors/99999/status", token=TOKEN)
check(f"Not found -> {s}", s == 404)


# ═══════════════════════════════════════════════════════════════════
# Auth checks
# ═══════════════════════════════════════════════════════════════════

print("\n19. List connectors without auth")
s, d = api("GET", "/connectors")
check(f"Unauthorized -> {s}", s in (401, 403))

print("\n20. Test connection without auth")
s, d = api("POST", f"/connectors/{CASINO_PROVIDER_ID}/test")
check(f"Unauthorized -> {s}", s in (401, 403))

print("\n21. Webhook does NOT require auth (public endpoint)")
s, d = api("POST", "/connectors/webhook/EVO", {
    "event_type": "health_check",
    "data": {},
})
check(f"Webhook public -> {s}", s == 200)


# ─── Summary ─────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
if failed == 0:
    print("All tests passed!")
else:
    print(f"{failed} test(s) failed")
