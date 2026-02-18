"""Integration test for Phase 10: content, roles, settings, audit logs."""

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


# ═══════════════════════════════════════════════════════════════════
# Login
# ═══════════════════════════════════════════════════════════════════

print("\n1. Login")
s, d = api("POST", "/auth/login", {"username": "superadmin", "password": "admin1234!"})
check(f"Login -> {s}", s == 200)
TOKEN = d["access_token"]


# ═══════════════════════════════════════════════════════════════════
# Announcement CRUD
# ═══════════════════════════════════════════════════════════════════

print("\n── Announcements ──")

print("\n2. Create notice")
s, d = api("POST", "/content/announcements", {
    "type": "notice",
    "title": "System Maintenance",
    "content": "Scheduled maintenance on Saturday.",
    "target": "all",
    "is_active": True,
}, TOKEN)
check(f"Create notice -> {s}", s == 201 and d.get("type") == "notice")
NOTICE_ID = d.get("id")

print("\n3. Create popup")
s, d = api("POST", "/content/announcements", {
    "type": "popup",
    "title": "Welcome Popup",
    "content": "<h1>Welcome!</h1><p>New features available.</p>",
    "target": "users",
    "is_active": True,
}, TOKEN)
check(f"Create popup -> {s}", s == 201 and d.get("type") == "popup")
POPUP_ID = d.get("id")

print("\n4. Create banner")
s, d = api("POST", "/content/announcements", {
    "type": "banner",
    "title": "Promotion Banner",
    "content": "50% bonus this weekend!",
    "target": "agents",
}, TOKEN)
check(f"Create banner -> {s}", s == 201 and d.get("type") == "banner")
BANNER_ID = d.get("id")

print("\n5. List all announcements")
s, d = api("GET", "/content/announcements", token=TOKEN)
check(f"List -> total={d.get('total', 0)}", s == 200 and d["total"] >= 3)

print("\n6. Filter by type=notice")
s, d = api("GET", "/content/announcements?type=notice", token=TOKEN)
check(f"Type filter -> {d.get('total', 0)}", s == 200 and d["total"] >= 1)
all_notice = all(a["type"] == "notice" for a in d["items"])
check("All items are notice", all_notice)

print("\n7. Filter by target=agents")
s, d = api("GET", "/content/announcements?target=agents", token=TOKEN)
check(f"Target filter -> {d.get('total', 0)}", s == 200 and d["total"] >= 1)

print("\n8. Search announcements")
s, d = api("GET", "/content/announcements?search=Maintenance", token=TOKEN)
check(f"Search -> {d.get('total', 0)}", s == 200 and d["total"] >= 1)

print("\n9. Get announcement detail")
s, d = api("GET", f"/content/announcements/{NOTICE_ID}", token=TOKEN)
check(f"Get -> title={d.get('title')}", s == 200 and d.get("id") == NOTICE_ID)

print("\n10. Update announcement")
s, d = api("PUT", f"/content/announcements/{NOTICE_ID}", {
    "title": "Updated: System Maintenance",
    "content": "Rescheduled to Sunday.",
}, TOKEN)
check(f"Update -> title={d.get('title')}", s == 200 and "Updated" in d.get("title", ""))

print("\n11. Soft delete announcement")
s, _ = api("DELETE", f"/content/announcements/{BANNER_ID}", token=TOKEN)
check(f"Delete -> {s}", s == 204)
s, d = api("GET", f"/content/announcements/{BANNER_ID}", token=TOKEN)
check(f"Soft deleted -> is_active={d.get('is_active')}", s == 200 and d.get("is_active") is False)

print("\n12. Get non-existent announcement")
s, d = api("GET", "/content/announcements/99999", token=TOKEN)
check(f"Not found -> {s}", s == 404)

print("\n13. Filter active only")
s, d = api("GET", "/content/announcements?is_active=true", token=TOKEN)
all_active = all(a["is_active"] for a in d["items"])
check(f"Active filter -> all active={all_active}", s == 200 and all_active)


# ═══════════════════════════════════════════════════════════════════
# Roles & Permissions
# ═══════════════════════════════════════════════════════════════════

print("\n── Roles & Permissions ──")

print("\n14. List all roles")
s, d = api("GET", "/roles", token=TOKEN)
check(f"List roles -> total={d.get('total', 0)}", s == 200 and d["total"] >= 1)
SYSTEM_ROLE_ID = None
for r in d["items"]:
    if r["is_system"]:
        SYSTEM_ROLE_ID = r["id"]
        break

print("\n15. Create custom role")
s, d = api("POST", "/roles", {
    "name": "test_custom_role",
    "description": "Test custom role for Phase 10",
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    s2, d2 = api("GET", "/roles", token=TOKEN)
    for r in d2["items"]:
        if r["name"] == "test_custom_role":
            d = r
            s = 201
            break
check(f"Create role -> {d.get('name')}", d.get("name") == "test_custom_role")
CUSTOM_ROLE_ID = d.get("id")

print("\n16. Duplicate role check")
s, d = api("POST", "/roles", {
    "name": "test_custom_role",
}, TOKEN)
check(f"Duplicate rejected -> {s}", s == 400)

print("\n17. Get role detail")
s, d = api("GET", f"/roles/{CUSTOM_ROLE_ID}", token=TOKEN)
check(f"Get role -> name={d.get('name')}", s == 200 and d.get("id") == CUSTOM_ROLE_ID)

print("\n18. Update role")
s, d = api("PUT", f"/roles/{CUSTOM_ROLE_ID}", {
    "description": "Updated custom role description",
}, TOKEN)
check(f"Update role -> desc={d.get('description')}", s == 200 and "Updated" in d.get("description", ""))

print("\n19. Cannot modify system role")
if SYSTEM_ROLE_ID:
    s, d = api("PUT", f"/roles/{SYSTEM_ROLE_ID}", {
        "description": "Try to modify system",
    }, TOKEN)
    check(f"System role blocked -> {s}", s == 400)
else:
    check("System role blocked (no system role found, skip)", True)

print("\n20. List all permissions")
s, d = api("GET", "/roles/permissions/all", token=TOKEN)
check(f"List permissions -> {len(d)} modules", s == 200 and len(d) >= 1)
# Get first few permission IDs
PERM_IDS = []
for group in d:
    for p in group.get("permissions", [])[:3]:
        PERM_IDS.append(p["id"])
    if len(PERM_IDS) >= 5:
        break

print("\n21. Assign permissions to role")
s, d = api("PUT", f"/roles/{CUSTOM_ROLE_ID}/permissions", {
    "permission_ids": PERM_IDS,
}, TOKEN)
check(f"Assign perms -> {len(d.get('permissions', []))} perms", s == 200 and len(d.get("permissions", [])) == len(PERM_IDS))

print("\n22. Cannot delete system role")
if SYSTEM_ROLE_ID:
    s, d = api("DELETE", f"/roles/{SYSTEM_ROLE_ID}", token=TOKEN)
    check(f"System role delete blocked -> {s}", s == 400)
else:
    check("System role delete blocked (skip)", True)

print("\n23. Delete custom role")
# Create temp role for deletion
s, d = api("POST", "/roles", {
    "name": "temp_delete_role",
    "description": "Temporary role for delete test",
}, TOKEN)
if s == 400 and "already exists" in d.get("detail", ""):
    s2, d2 = api("GET", "/roles", token=TOKEN)
    for r in d2["items"]:
        if r["name"] == "temp_delete_role":
            d = r
            break
TEMP_ROLE_ID = d.get("id")
s, _ = api("DELETE", f"/roles/{TEMP_ROLE_ID}", token=TOKEN)
check(f"Delete role -> {s}", s == 204)


# ═══════════════════════════════════════════════════════════════════
# System Settings
# ═══════════════════════════════════════════════════════════════════

print("\n── System Settings ──")

print("\n24. Update (create) setting")
s, d = api("PUT", "/settings/general/site_name", {
    "value": {"name": "Admin Panel", "version": "1.0"},
}, TOKEN)
check(f"Create setting -> key={d.get('key')}", s == 200 and d.get("key") == "site_name")

print("\n25. Update another setting")
s, d = api("PUT", "/settings/general/maintenance_mode", {
    "value": {"enabled": False},
}, TOKEN)
check(f"Create setting 2 -> key={d.get('key')}", s == 200 and d.get("key") == "maintenance_mode")

print("\n26. Create settings in another group")
s, d = api("PUT", "/settings/notification/email_enabled", {
    "value": {"enabled": True, "smtp_host": "smtp.example.com"},
}, TOKEN)
check(f"Notification setting -> key={d.get('key')}", s == 200)

print("\n27. List all settings (grouped)")
s, d = api("GET", "/settings", token=TOKEN)
check(f"List -> {len(d)} groups", s == 200 and len(d) >= 2)

print("\n28. Get settings by group")
s, d = api("GET", "/settings/general", token=TOKEN)
check(f"Group -> {len(d.get('settings', []))} settings", s == 200 and len(d.get("settings", [])) >= 2)

print("\n29. Non-existent group")
s, d = api("GET", "/settings/nonexistent", token=TOKEN)
check(f"Not found -> {s}", s == 404)

print("\n30. Bulk update settings")
s, d = api("POST", "/settings/bulk", {
    "items": [
        {"group_name": "general", "key": "site_name", "value": {"name": "Updated Panel"}},
        {"group_name": "general", "key": "timezone", "value": {"tz": "Asia/Seoul"}},
    ],
}, TOKEN)
check(f"Bulk update -> {len(d)} items", s == 200 and len(d) == 2)


# ═══════════════════════════════════════════════════════════════════
# Audit Logs
# ═══════════════════════════════════════════════════════════════════

print("\n── Audit Logs ──")

print("\n31. List audit logs")
s, d = api("GET", "/audit/logs", token=TOKEN)
check(f"List -> total={d.get('total', 0)}", s == 200 and "total" in d)

print("\n32. Filter by action")
s, d = api("GET", "/audit/logs?action=create", token=TOKEN)
check(f"Action filter -> {s}", s == 200)

print("\n33. Filter by module")
s, d = api("GET", "/audit/logs?module=auth", token=TOKEN)
check(f"Module filter -> {s}", s == 200)

print("\n34. Pagination")
s, d = api("GET", "/audit/logs?page=1&page_size=5", token=TOKEN)
check(f"Pagination -> items={len(d.get('items', []))}", s == 200 and len(d.get("items", [])) <= 5)

print("\n35. Get audit log detail")
if d.get("items"):
    first_log_id = d["items"][0]["id"]
    s2, d2 = api("GET", f"/audit/logs/{first_log_id}", token=TOKEN)
    check(f"Detail -> id={d2.get('id')}", s2 == 200 and d2.get("id") == first_log_id)
else:
    check("Detail (no logs, skip)", True)

print("\n36. Get non-existent audit log")
s, d = api("GET", "/audit/logs/99999", token=TOKEN)
check(f"Not found -> {s}", s == 404)

print("\n37. Export audit logs (Excel)")
# Export returns binary xlsx, handle separately
try:
    headers = {"Authorization": f"Bearer {TOKEN}"}
    req = urllib.request.Request(f"{BASE}/audit/logs/export", headers=headers, method="GET")
    with urllib.request.urlopen(req) as r:
        export_status = r.status
        content_type = r.headers.get("Content-Type", "")
        data = r.read()
        check(f"Export -> {export_status}, size={len(data)}", export_status == 200 and len(data) > 100)
except urllib.error.HTTPError as e:
    check(f"Export -> {e.code}", False)

# ─── Cleanup test role ─────────────────────────────────────────────
print("\n38. Cleanup: delete test custom role")
s, _ = api("DELETE", f"/roles/{CUSTOM_ROLE_ID}", token=TOKEN)
check(f"Cleanup role -> {s}", s == 204)


# ─── Summary ─────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
if failed == 0:
    print("All tests passed!")
else:
    print(f"{failed} test(s) failed")
