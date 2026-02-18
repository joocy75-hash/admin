# Phase 1 Handoff: DB Schema + Model Definition

## Status: COMPLETE

## Summary
18 tables created across 8 model files using SQLModel + PostgreSQL 16. Alembic migration applied, seed data loaded.

## Models Created

| File | Models | Tables |
|------|--------|--------|
| admin_user.py | AdminUser, AdminUserTree | admin_users, admin_user_tree |
| role.py | Role, Permission, RolePermission, AdminUserRole | roles, permissions, role_permissions, admin_user_roles |
| commission.py | CommissionPolicy, AgentCommissionOverride, CommissionLedger | commission_policies, agent_commission_overrides, commission_ledger |
| settlement.py | Settlement | settlements |
| transaction.py | Transaction | transactions |
| game.py | GameProvider, Game, GameRound | game_providers, games, game_rounds |
| audit_log.py | AuditLog | audit_logs |
| setting.py | Setting, Announcement, AgentSalaryConfig | settings, announcements, agent_salary_configs |

## Key Design Decisions

1. **Closure Table** (admin_user_tree): Stores all ancestor-descendant pairs for efficient subtree queries
2. **Dual Commission Rates**: AdminUser has rolling_rate, losing_rate, deposit_rate (NULL = use policy default)
3. **JSONB Fields**: CommissionPolicy.level_rates, Setting.value, AuditLog.before_data/after_data
4. **Decimal Precision**: Financial fields use Decimal(18,2); commission rates use Decimal(5,4)
5. **State Machines**: CommissionLedger (pending->settled->withdrawn), Settlement (draft->confirmed->paid)
6. **Balance Snapshot**: Transaction stores balance_before/balance_after for audit trail

## Seed Data

- **superadmin** account (agent_code: SA0001, password: admin1234!)
- 6 roles: super_admin, admin, teacher, sub_hq, agent, sub_agent
- 47 permissions across 12 modules
- super_admin role: 47/47 permissions, admin role: 42/47 (no role management)

## Migration

- File: `alembic/versions/7656a57c4653_initial_schema.py`
- Command: `PYTHONPATH=. alembic upgrade head`

## Issues Resolved

1. **passlib + bcrypt incompatibility**: passlib fails with bcrypt 4.x on Python 3.14. Switched to `bcrypt` directly
2. **psycopg2-binary missing**: Alembic sync driver not installed. Added to requirements.txt
3. **PYTHONPATH required**: Alembic can't find `app` module. Must run with `PYTHONPATH=.`

## Next Phase: Phase 2 (Auth + RBAC API)

- JWT login/logout endpoints
- RBAC middleware with permission checks
- Admin user CRUD with hierarchy validation
- Password reset + 2FA (TOTP)
