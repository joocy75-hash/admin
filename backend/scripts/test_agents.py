"""Integration test for agent CRUD and tree APIs."""

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
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name}")


# Login
print("\n1. Login as superadmin")
status_code, data = api("POST", "/auth/login", {"username": "superadmin", "password": "admin1234!"})
check("Login 200", status_code == 200)
TOKEN = data["access_token"]

# Create agents (6-level hierarchy)
print("\n2. Create agent hierarchy")

agents = {}
hierarchy = [
    ("admin01", "admin", "ADM001", None),
    ("teacher01", "teacher", "TCH001", "admin01"),
    ("subhq01", "sub_hq", "SHQ001", "teacher01"),
    ("agent01", "agent", "AGT001", "subhq01"),
    ("subagent01", "sub_agent", "SAG001", "agent01"),
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
    check(f"Create {username} ({role}) → {s}", s == 201)
    if s == 201:
        agents[username] = d

# List agents
print("\n3. List agents")
s, d = api("GET", "/agents?page=1&page_size=10", token=TOKEN)
check(f"List → {d.get('total', 0)} agents", s == 200 and d["total"] >= 5)

# Search
s, d = api("GET", "/agents?search=teacher", token=TOKEN)
check(f"Search 'teacher' → {d.get('total', 0)} results", s == 200 and d["total"] >= 1)

# Filter by role
s, d = api("GET", "/agents?role=agent", token=TOKEN)
check(f"Filter role=agent → {d.get('total', 0)} results", s == 200 and d["total"] >= 1)

# Get one
print("\n4. Get single agent")
agent_id = agents["agent01"]["id"]
s, d = api("GET", f"/agents/{agent_id}", token=TOKEN)
check(f"Get agent01 → role={d.get('role')}", s == 200 and d["role"] == "agent")

# Update
print("\n5. Update agent")
s, d = api("PUT", f"/agents/{agent_id}", {"memo": "Updated via test"}, TOKEN)
check(f"Update memo → {d.get('memo')}", s == 200 and d["memo"] == "Updated via test")

# Tree: get subtree
print("\n6. Tree operations")
root_id = agents["admin01"]["id"]
s, d = api("GET", f"/agents/{root_id}/tree", token=TOKEN)
check(f"Subtree from admin01 → {len(d.get('nodes', []))} nodes", s == 200 and len(d["nodes"]) >= 5)

# Ancestors
sa_id = agents["subagent01"]["id"]
s, d = api("GET", f"/agents/{sa_id}/ancestors", token=TOKEN)
check(f"Ancestors of subagent01 → {len(d)} levels", s == 200 and len(d) >= 4)

# Children
s, d = api("GET", f"/agents/{root_id}/children", token=TOKEN)
check(f"Children of admin01 → {len(d)} direct children", s == 200 and len(d) >= 1)

# Reset password
print("\n7. Password reset")
s, d = api("POST", f"/agents/{agent_id}/reset-password", {"new_password": "newpass123"}, TOKEN)
check(f"Reset password → {d.get('detail')}", s == 200)

# Delete (soft)
print("\n8. Soft delete")
sa_id = agents["subagent01"]["id"]
s, d = api("DELETE", f"/agents/{sa_id}", token=TOKEN)
check("Delete subagent01 → 204", s == 204)

# Verify banned status
s, d = api("GET", f"/agents/{sa_id}", token=TOKEN)
check(f"Status after delete → {d.get('status')}", s == 200 and d["status"] == "banned")

# Summary
print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
if failed == 0:
    print("🎉 All tests passed!")
else:
    print(f"⚠️  {failed} test(s) failed")
