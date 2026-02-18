---
name: db-migrate
description: Create or run Alembic migrations
---

Handle database migration based on arguments:

**If "$ARGUMENTS" contains "create" or "new":**
1. Extract migration name from arguments
2. `cd backend && source .venv/bin/activate && PYTHONPATH=. alembic revision --autogenerate -m "{name}"`
3. Show the generated migration file

**If "$ARGUMENTS" contains "up" or "upgrade" or is empty:**
1. `cd backend && source .venv/bin/activate && PYTHONPATH=. alembic upgrade head`
2. Report migration status

**If "$ARGUMENTS" contains "down" or "downgrade":**
1. Confirm with user before proceeding
2. `cd backend && source .venv/bin/activate && PYTHONPATH=. alembic downgrade -1`

**If "$ARGUMENTS" contains "status" or "history":**
1. `cd backend && source .venv/bin/activate && PYTHONPATH=. alembic current`
2. `cd backend && source .venv/bin/activate && PYTHONPATH=. alembic history --verbose -r -3:`

Always show current migration state after any operation.
