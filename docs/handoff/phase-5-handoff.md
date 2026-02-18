# Phase 5: Commission System — Handoff

## Completed

### Backend
- **commission_engine.py** — Dual commission calculation:
  - `calculate_rolling_commission()` — bet_amount × rate (per ancestor level)
  - `calculate_losing_commission()` — loss_amount × rate (only on user loss)
  - `_find_policy()` — category-specific > generic fallback, priority-ordered
  - `_get_override_rates()` — agent-specific rate overrides
  - `_calc_amount()` — Decimal precision with ROUND_HALF_UP
- **commissions.py** (API router) — 12 endpoints:
  - Policy CRUD: GET/POST/PUT/DELETE `/commissions/policies`
  - Override CRUD: GET/POST/PUT/DELETE `/commissions/overrides`
  - Ledger: GET `/commissions/ledger` (paginated, filtered)
  - Summary: GET `/commissions/ledger/summary` (grouped by type)
  - Webhook: POST `/commissions/webhook/bet` (rolling)
  - Webhook: POST `/commissions/webhook/round-result` (losing)
- **commission.py** (schemas) — 12 Pydantic models for policies, overrides, ledger, webhooks

### Frontend
- **Commission policies page** (`/dashboard/commissions`) — table with type/category filters, CRUD
- **Policy create page** (`/dashboard/commissions/new`) — form with level rates builder
- **Policy detail page** (`/dashboard/commissions/[id]`) — 2 tabs:
  - Settings: edit name, rates, min_bet, priority, active status
  - Overrides: manage agent-specific rate overrides
- **Ledger page** (`/dashboard/commissions/ledger`) — full ledger with:
  - Summary cards (rolling/losing totals)
  - Filters: type, status, agent_id, date range
  - Paginated table with all commission details
- **Overrides page** (`/dashboard/commissions/overrides`) — global override management

## Key Files
| File | Purpose |
|------|---------|
| `backend/app/services/commission_engine.py` | Rolling + Losing calculation |
| `backend/app/schemas/commission.py` | 12 Pydantic schemas |
| `backend/app/api/v1/commissions.py` | 12 commission API endpoints |
| `frontend/src/hooks/use-commissions.ts` | API client hooks |
| `frontend/src/app/dashboard/commissions/page.tsx` | Policy list |
| `frontend/src/app/dashboard/commissions/new/page.tsx` | Policy create |
| `frontend/src/app/dashboard/commissions/[id]/page.tsx` | Policy detail + overrides |
| `frontend/src/app/dashboard/commissions/ledger/page.tsx` | Commission ledger |
| `frontend/src/app/dashboard/commissions/overrides/page.tsx` | Override management |

## Commission Flow
```
Bet Event (webhook/bet)
  → find rolling policy (category-specific > generic)
  → get agent's ancestors from closure table
  → for each level: check override → apply rate → create ledger entry
  → update agent.pending_balance

Game Loss (webhook/round-result, result=lose)
  → find losing policy
  → loss = bet - win
  → same ancestor distribution as rolling
  → create ledger entries with type=losing
```

## Verification
- [x] `next build --webpack` compiles without errors (13 routes)
- [x] Backend 21/21 integration tests passed
- [x] Rolling commission: 3-level distribution (L1: 0.5%, L2: 0.3%, L3: 0.1%)
- [x] Losing commission: 3-level distribution (L1: 5%, L2: 3%, L3: 1%)
- [x] Duplicate webhook prevention (same round_id)
- [x] Win result → no losing commission
- [x] Override rates applied per agent
- [x] Ledger summary aggregation by type

## Test Data Created
| Policy | Type | Category | Rates |
|--------|------|----------|-------|
| Casino Rolling | rolling | casino | L1:0.5%, L2:0.3%, L3:0.1% |
| Casino Losing | losing | casino | L1:5%, L2:3%, L3:1% |
| Default Rolling | rolling | (all) | L1:0.3%, L2:0.2%, L3:0.05% |

## Next: Phase 6 (Settlement System)
- Settlement creation (period → aggregate pending commissions)
- Settlement preview API
- Confirm/reject workflow
- Payment processing (agent balance update)
- Auto-settlement scheduler
- Settlement management UI
