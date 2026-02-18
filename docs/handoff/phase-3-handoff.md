# Phase 3: Frontend Auth + Layout — Handoff

## Completed
- API client (`api-client.ts`) with JWT auto-attach, 401 auto-refresh, 204 handling
- Zustand auth store with token persistence (localStorage), permissions array, hasPermission()
- Login page with progressive 2FA (TOTP field appears only when server requires it)
- AuthGuard component — redirects to /login when not authenticated
- Sidebar navigation — 11 items filtered by user permissions, logout button
- Dashboard layout — AuthGuard + SidebarNav wrapping all /dashboard/* routes
- Dashboard page — 8 stat cards (placeholder values)
- Root page (/) redirects to /dashboard

## Key Files
| File | Purpose |
|------|---------|
| `frontend/src/lib/api-client.ts` | Fetch wrapper with JWT + auto-refresh |
| `frontend/src/stores/auth-store.ts` | Zustand auth state (user, tokens, permissions) |
| `frontend/src/app/login/page.tsx` | Login with 2FA support |
| `frontend/src/components/auth-guard.tsx` | Client-side route protection |
| `frontend/src/components/sidebar-nav.tsx` | Permission-aware sidebar |
| `frontend/src/app/dashboard/layout.tsx` | Protected layout wrapper |
| `frontend/src/app/dashboard/page.tsx` | Dashboard with stat cards |
| `frontend/src/app/page.tsx` | Root redirect to /dashboard |

## Auth Flow
1. User submits credentials on /login
2. POST /api/v1/auth/login → receives access_token + refresh_token
3. GET /api/v1/auth/me (with access_token) → receives user profile + permissions
4. setAuth() stores everything in Zustand (persisted to localStorage)
5. Redirect to /dashboard
6. AuthGuard checks isAuthenticated from store
7. SidebarNav filters items by hasPermission()

## Token Refresh
- api-client intercepts 401 responses
- Calls POST /api/v1/auth/refresh with stored refresh_token
- Updates tokens in localStorage directly
- Retries original request with new access_token

## Build Notes
- Turbopack crashes on non-ASCII paths (관리자페이지) — use `--webpack` flag
- `next.config.ts` cleaned up (removed invalid `experimental.turbo`)
- Port 3000 occupied by another project — use port 3001 for dev
- CORS updated in `.env` to allow both localhost:3000 and localhost:3001
- Backend runs on port 8002 (8000 occupied by PHP server)

## Verification
- [x] `next build --webpack` compiles without errors
- [x] TypeScript passes
- [x] Login page renders at /login
- [x] CORS preflight returns 200 with correct allow-origin
- [x] Login API returns tokens
- [x] /me API returns full user profile with 47 permissions

## Next: Phase 4 (Agent Management)
- Agent CRUD API endpoints
- Agent tree (closure table) visualization
- Agent list page with DataTable
- Agent create/edit forms
