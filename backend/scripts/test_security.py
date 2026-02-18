"""Security tests for Phase 13 — rate limiting, headers, health check, CORS."""

import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import httpx

BASE_URL = "http://localhost:8002"


async def test_rate_limiting():
    """Login endpoint should reject after 5 requests in 60 seconds."""
    print("=== Test: Rate Limiting (login) ===")
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # Flush rate limit keys first
        for i in range(6):
            resp = await client.post(
                "/api/v1/auth/login",
                json={"username": "testuser", "password": "wrong"},
            )
            print(f"  Request {i+1}: status={resp.status_code}")
            if i == 5:
                if resp.status_code == 429:
                    print("  PASS: 6th request got 429 Too Many Requests")
                    retry_after = resp.headers.get("Retry-After")
                    print(f"  Retry-After: {retry_after}s")
                else:
                    print(f"  FAIL: Expected 429, got {resp.status_code}")
    print()


async def test_security_headers():
    """All responses should include security headers."""
    print("=== Test: Security Headers ===")
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        resp = await client.get("/health")
        expected = {
            "x-content-type-options": "nosniff",
            "x-frame-options": "DENY",
            "x-xss-protection": "1; mode=block",
            "referrer-policy": "strict-origin-when-cross-origin",
        }
        all_pass = True
        for header, value in expected.items():
            actual = resp.headers.get(header)
            if actual == value:
                print(f"  PASS: {header} = {actual}")
            else:
                print(f"  FAIL: {header} expected={value}, got={actual}")
                all_pass = False

        # API paths should have Cache-Control: no-store
        resp_api = await client.get("/api/v1/auth/me")
        cache_ctrl = resp_api.headers.get("cache-control")
        if cache_ctrl == "no-store":
            print(f"  PASS: Cache-Control = no-store (API path)")
        else:
            print(f"  FAIL: Cache-Control expected=no-store, got={cache_ctrl}")
    print()


async def test_health_check():
    """Health check should return DB and Redis status."""
    print("=== Test: Enhanced Health Check ===")
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        resp = await client.get("/health")
        data = resp.json()
        print(f"  Status: {data.get('status')}")
        print(f"  Version: {data.get('version')}")
        checks = data.get("checks", {})
        for service, status in checks.items():
            label = "PASS" if status == "ok" else "WARN"
            print(f"  {label}: {service} = {status}")
    print()


async def test_cors():
    """CORS should allow configured origins."""
    print("=== Test: CORS Headers ===")
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # Preflight request
        resp = await client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://localhost:3001",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type,Authorization",
            },
        )
        origin = resp.headers.get("access-control-allow-origin")
        if origin == "http://localhost:3001":
            print(f"  PASS: Allow-Origin = {origin}")
        else:
            print(f"  FAIL: Allow-Origin expected=http://localhost:3001, got={origin}")

        creds = resp.headers.get("access-control-allow-credentials")
        if creds == "true":
            print(f"  PASS: Allow-Credentials = true")
        else:
            print(f"  FAIL: Allow-Credentials = {creds}")
    print()


async def test_rate_limit_headers():
    """API responses should include rate limit headers."""
    print("=== Test: Rate Limit Headers ===")
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        resp = await client.get("/health")
        limit = resp.headers.get("x-ratelimit-limit")
        remaining = resp.headers.get("x-ratelimit-remaining")
        # Health check is not under /api/ so no rate limit headers
        print(f"  /health (non-API): X-RateLimit-Limit={limit} (expected: None)")

        resp = await client.get("/api/v1/auth/me")
        limit = resp.headers.get("x-ratelimit-limit")
        remaining = resp.headers.get("x-ratelimit-remaining")
        if limit:
            print(f"  PASS: X-RateLimit-Limit = {limit}")
        else:
            print(f"  FAIL: X-RateLimit-Limit missing")
        if remaining is not None:
            print(f"  PASS: X-RateLimit-Remaining = {remaining}")
        else:
            print(f"  FAIL: X-RateLimit-Remaining missing")
    print()


async def main():
    print(f"\nSecurity Test Suite — {BASE_URL}\n")
    await test_security_headers()
    await test_health_check()
    await test_cors()
    await test_rate_limit_headers()
    await test_rate_limiting()
    print("All security tests completed.\n")


if __name__ == "__main__":
    asyncio.run(main())
