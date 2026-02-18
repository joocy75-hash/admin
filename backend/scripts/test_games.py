"""Integration test for game management: providers, games, rounds."""

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

# ═══════════════════════════════════════════════════════════════════
# GameProvider CRUD
# ═══════════════════════════════════════════════════════════════════

# ─── Create Provider ──────────────────────────────────────────────
print("\n2. Create casino provider")
s, d = api("POST", "/games/providers", {
    "name": "Evolution Gaming",
    "code": "EVO",
    "category": "casino",
    "api_url": "https://api.evolution.com",
    "description": "Live casino provider",
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    s2, d2 = api("GET", "/games/providers?search=EVO", token=TOKEN)
    if s2 == 200 and d2["items"]:
        d = d2["items"][0]
        s = 200
check(f"Casino provider -> {d.get('name')}", d.get("code") == "EVO")
CASINO_PROVIDER_ID = d["id"]

print("\n3. Create slot provider")
s, d = api("POST", "/games/providers", {
    "name": "Pragmatic Play",
    "code": "PP",
    "category": "slot",
    "description": "Slot games provider",
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    s2, d2 = api("GET", "/games/providers?search=PP", token=TOKEN)
    if s2 == 200 and d2["items"]:
        d = d2["items"][0]
        s = 200
check(f"Slot provider -> {d.get('name')}", d.get("code") == "PP")
SLOT_PROVIDER_ID = d["id"]

print("\n4. Create sports provider")
s, d = api("POST", "/games/providers", {
    "name": "Kambi Sports",
    "code": "KAMBI",
    "category": "sports",
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    s2, d2 = api("GET", "/games/providers?search=KAMBI", token=TOKEN)
    if s2 == 200 and d2["items"]:
        d = d2["items"][0]
        s = 200
check(f"Sports provider -> {d.get('name')}", d.get("code") == "KAMBI")

# ─── Duplicate Provider Check ────────────────────────────────────
print("\n5. Duplicate provider check")
s, d = api("POST", "/games/providers", {
    "name": "Evolution Gaming",
    "code": "EVO_DUP",
    "category": "casino",
}, TOKEN)
check(f"Duplicate rejected -> {s}", s == 400)

# ─── List Providers ──────────────────────────────────────────────
print("\n6. List all providers")
s, d = api("GET", "/games/providers", token=TOKEN)
check(f"List -> {d.get('total', 0)} providers", s == 200 and d["total"] >= 3)

# ─── Filter Provider by category ─────────────────────────────────
print("\n7. Filter providers by category")
s, d = api("GET", "/games/providers?category=casino", token=TOKEN)
check(f"Casino filter -> {d.get('total', 0)}", s == 200 and d["total"] >= 1)
all_casino = all(p["category"] == "casino" for p in d["items"])
check("All items are casino", all_casino)

# ─── Search Provider ─────────────────────────────────────────────
print("\n8. Search providers")
s, d = api("GET", "/games/providers?search=Evolution", token=TOKEN)
check(f"Search -> {d.get('total', 0)}", s == 200 and d["total"] >= 1)

# ─── Get Provider ────────────────────────────────────────────────
print("\n9. Get provider detail")
s, d = api("GET", f"/games/providers/{CASINO_PROVIDER_ID}", token=TOKEN)
check(f"Get -> {d.get('name')}", s == 200 and d.get("id") == CASINO_PROVIDER_ID)

# ─── Update Provider ─────────────────────────────────────────────
print("\n10. Update provider")
s, d = api("PUT", f"/games/providers/{CASINO_PROVIDER_ID}", {
    "description": "Updated live casino provider",
}, TOKEN)
check(f"Update -> description={d.get('description')}", s == 200 and "Updated" in d.get("description", ""))

# ═══════════════════════════════════════════════════════════════════
# Game CRUD
# ═══════════════════════════════════════════════════════════════════

# ─── Create Games ────────────────────────────────────────────────
print("\n11. Create casino game")
s, d = api("POST", "/games", {
    "provider_id": CASINO_PROVIDER_ID,
    "name": "Lightning Roulette",
    "code": "EVO_LR",
    "category": "casino",
    "sort_order": 1,
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    s2, d2 = api("GET", "/games?search=EVO_LR", token=TOKEN)
    if s2 == 200 and d2["items"]:
        d = d2["items"][0]
        s = 200
check(f"Casino game -> {d.get('name')}", d.get("code") == "EVO_LR")
CASINO_GAME_ID = d["id"]

print("\n12. Create slot game")
s, d = api("POST", "/games", {
    "provider_id": SLOT_PROVIDER_ID,
    "name": "Sweet Bonanza",
    "code": "PP_SB",
    "category": "slot",
    "sort_order": 1,
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    s2, d2 = api("GET", "/games?search=PP_SB", token=TOKEN)
    if s2 == 200 and d2["items"]:
        d = d2["items"][0]
        s = 200
check(f"Slot game -> {d.get('name')}", d.get("code") == "PP_SB")

print("\n13. Create another casino game")
s, d = api("POST", "/games", {
    "provider_id": CASINO_PROVIDER_ID,
    "name": "Crazy Time",
    "code": "EVO_CT",
    "category": "casino",
    "sort_order": 2,
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    s2, d2 = api("GET", "/games?search=EVO_CT", token=TOKEN)
    if s2 == 200 and d2["items"]:
        d = d2["items"][0]
        s = 200
check(f"Casino game 2 -> {d.get('name')}", d.get("code") == "EVO_CT")

# ─── Duplicate Game Code Check ───────────────────────────────────
print("\n14. Duplicate game code check")
s, d = api("POST", "/games", {
    "provider_id": CASINO_PROVIDER_ID,
    "name": "Duplicate",
    "code": "EVO_LR",
    "category": "casino",
}, TOKEN)
check(f"Duplicate rejected -> {s}", s == 400)

# ─── Invalid Provider Check ─────────────────────────────────────
print("\n15. Invalid provider check")
s, d = api("POST", "/games", {
    "provider_id": 99999,
    "name": "Invalid",
    "code": "INVALID_001",
    "category": "casino",
}, TOKEN)
check(f"Invalid provider -> {s}", s == 400)

# ─── List Games ──────────────────────────────────────────────────
print("\n16. List all games")
s, d = api("GET", "/games", token=TOKEN)
check(f"List -> {d.get('total', 0)} games", s == 200 and d["total"] >= 3)

# ─── Filter by category ─────────────────────────────────────────
print("\n17. Filter games by category")
s, d = api("GET", "/games?category=casino", token=TOKEN)
check(f"Casino games -> {d.get('total', 0)}", s == 200 and d["total"] >= 2)

# ─── Filter by provider ─────────────────────────────────────────
print("\n18. Filter games by provider")
s, d = api("GET", f"/games?provider_id={SLOT_PROVIDER_ID}", token=TOKEN)
check(f"Slot provider games -> {d.get('total', 0)}", s == 200 and d["total"] >= 1)

# ─── Search Games ────────────────────────────────────────────────
print("\n19. Search games")
s, d = api("GET", "/games?search=Bonanza", token=TOKEN)
check(f"Search -> {d.get('total', 0)}", s == 200 and d["total"] >= 1)

# ─── Get Game Detail ─────────────────────────────────────────────
print("\n20. Get game detail")
s, d = api("GET", f"/games/{CASINO_GAME_ID}", token=TOKEN)
check(f"Get -> provider_name={d.get('provider_name')}", s == 200 and d.get("provider_name") is not None)

# ─── Update Game ─────────────────────────────────────────────────
print("\n21. Update game")
s, d = api("PUT", f"/games/{CASINO_GAME_ID}", {
    "sort_order": 10,
    "thumbnail_url": "https://example.com/lr.png",
}, TOKEN)
check(f"Update -> sort_order={d.get('sort_order')}", s == 200 and d.get("sort_order") == 10)

# ─── Delete Game (soft) ─────────────────────────────────────────
print("\n22. Soft delete game")
# Create a temporary game for deletion test
s, d = api("POST", "/games", {
    "provider_id": CASINO_PROVIDER_ID,
    "name": "Delete Me",
    "code": "DEL_TEST_001",
    "category": "casino",
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    s2, d2 = api("GET", "/games?search=DEL_TEST_001", token=TOKEN)
    if s2 == 200 and d2["items"]:
        d = d2["items"][0]
DEL_GAME_ID = d["id"]
s, _ = api("DELETE", f"/games/{DEL_GAME_ID}", token=TOKEN)
check(f"Delete -> {s}", s == 204)
# Verify soft delete
s, d = api("GET", f"/games/{DEL_GAME_ID}", token=TOKEN)
check(f"Soft deleted -> is_active={d.get('is_active')}", s == 200 and d.get("is_active") is False)

# ─── Delete Provider (soft) ──────────────────────────────────────
print("\n23. Soft delete provider")
# Create temp provider for deletion
s, d = api("POST", "/games/providers", {
    "name": "Delete Provider",
    "code": "DEL_PROV",
    "category": "mini_game",
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    s2, d2 = api("GET", "/games/providers?search=DEL_PROV", token=TOKEN)
    if s2 == 200 and d2["items"]:
        d = d2["items"][0]
DEL_PROV_ID = d["id"]
s, _ = api("DELETE", f"/games/providers/{DEL_PROV_ID}", token=TOKEN)
check(f"Delete provider -> {s}", s == 204)

# ─── Filter active only ─────────────────────────────────────────
print("\n24. Filter active providers")
s, d = api("GET", "/games/providers?is_active=true", token=TOKEN)
all_active = all(p["is_active"] for p in d["items"])
check(f"Active filter -> all active={all_active}", s == 200 and all_active)

# ═══════════════════════════════════════════════════════════════════
# GameRound (read-only, create via direct DB insert simulation)
# ═══════════════════════════════════════════════════════════════════

print("\n25. List rounds (empty or existing)")
s, d = api("GET", "/games/rounds", token=TOKEN)
check(f"List rounds -> {s}", s == 200 and "total" in d)

print("\n26. Filter rounds by game_id")
s, d = api("GET", f"/games/rounds?game_id={CASINO_GAME_ID}", token=TOKEN)
check(f"Filter by game -> {s}", s == 200)

print("\n27. Get non-existent round")
s, d = api("GET", "/games/rounds/99999", token=TOKEN)
check(f"Not found -> {s}", s == 404)

# ─── Summary ─────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
if failed == 0:
    print("All tests passed!")
else:
    print(f"{failed} test(s) failed")
