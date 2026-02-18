---
name: test
description: Run backend tests or frontend build check
---

Run the appropriate tests based on arguments:

**If "$ARGUMENTS" contains "backend" or "back" or is empty:**
1. `cd backend && source .venv/bin/activate && PYTHONPATH=. python -m pytest tests/ -v`
2. Report pass/fail count

**If "$ARGUMENTS" contains "frontend" or "front":**
1. `cd frontend && npx next build --webpack`
2. Report build success/failure

**If "$ARGUMENTS" contains "all":**
1. Run both backend tests and frontend build
2. Report combined results

Show a summary table of results when done.
