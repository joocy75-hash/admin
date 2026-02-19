"""Auth API integration test script."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asyncio
import json

import asyncpg
import httpx

BASE = "http://127.0.0.1:8002/api/v1"


def test_auth():
    # 1. Login
    print("=== 1. Login ===")
    r = httpx.post(f"{BASE}/auth/login", json={"username": "superadmin", "password": "admin1234!"})
    print(f"Status: {r.status_code}")
    data = r.json()
    print(json.dumps(data, indent=2))

    if r.status_code != 200:
        print("Login failed, stopping tests")
        return False

    token = data["access_token"]
    refresh = data["refresh_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get /me
    print("\n=== 2. Get /me ===")
    r = httpx.get(f"{BASE}/auth/me", headers=headers)
    print(f"Status: {r.status_code}")
    me = r.json()
    print(json.dumps(me, indent=2))
    assert me["username"] == "superadmin"
    assert me["role"] == "super_admin"
    assert len(me["permissions"]) == 47

    # 3. Refresh
    print("\n=== 3. Refresh Token ===")
    r = httpx.post(f"{BASE}/auth/refresh", json={"refresh_token": refresh})
    print(f"Status: {r.status_code}")
    assert r.status_code == 200
    print("Refresh OK")

    # 4. Wrong password
    print("\n=== 4. Wrong Password ===")
    r = httpx.post(f"{BASE}/auth/login", json={"username": "superadmin", "password": "wrong"})
    print(f"Status: {r.status_code} -> {r.json()['detail']}")
    assert r.status_code == 401

    # 5. No auth
    print("\n=== 5. No Auth Token ===")
    r = httpx.get(f"{BASE}/auth/me")
    print(f"Status: {r.status_code}")
    assert r.status_code in (401, 403)

    # 6. Change password
    print("\n=== 6. Change Password ===")
    r = httpx.post(f"{BASE}/auth/change-password", headers=headers, json={
        "current_password": "admin1234!",
        "new_password": "newpass1234",
    })
    print(f"Status: {r.status_code} -> {r.json()}")
    assert r.status_code == 200

    # 7. Login with new password
    print("\n=== 7. Login with new password ===")
    r = httpx.post(f"{BASE}/auth/login", json={"username": "superadmin", "password": "newpass1234"})
    print(f"Status: {r.status_code} -> {'OK' if r.status_code == 200 else 'FAIL'}")
    assert r.status_code == 200

    # 8. Revert password
    new_token = r.json()["access_token"]
    r = httpx.post(f"{BASE}/auth/change-password", headers={"Authorization": f"Bearer {new_token}"}, json={
        "current_password": "newpass1234",
        "new_password": "admin1234!",
    })
    print("\n=== 8. Revert Password ===")
    print(f"Status: {r.status_code} -> {r.json()}")
    assert r.status_code == 200

    # 9. Logout
    print("\n=== 9. Logout ===")
    r = httpx.post(f"{BASE}/auth/logout", headers=headers)
    print(f"Status: {r.status_code}")
    assert r.status_code == 204

    # 10. Audit logs
    print("\n=== 10. Audit Logs ===")

    async def check_logs():
        conn = await asyncpg.connect("postgresql://admin:admin1234@localhost:5433/admin_panel")
        rows = await conn.fetch(
            "SELECT action, module, description, admin_user_id FROM audit_logs ORDER BY id DESC LIMIT 5"
        )
        for row in rows:
            print(f"  {row['action']:8} | {row['module']:15} | {row['description']:40} | user_id={row['admin_user_id']}")
        count = await conn.fetchval("SELECT count(*) FROM audit_logs")
        print(f"\n  Total audit logs: {count}")
        await conn.close()

    asyncio.run(check_logs())

    print("\n=== ALL TESTS PASSED ===")
    return True


if __name__ == "__main__":
    success = test_auth()
    sys.exit(0 if success else 1)
