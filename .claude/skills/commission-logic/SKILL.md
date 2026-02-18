---
name: commission-logic
description: Commission calculation business logic for the game admin panel
---

# Commission Business Logic

## Commission Types

### Rolling Commission (롤링)
- Trigger: Every bet placed
- Formula: `bet_amount * rolling_rate`
- Distribution: Split across ancestor chain (agent tree upward)
- Applies to: All 7 game categories

### Losing Commission (죽장)
- Trigger: Only when user loses (game round result = "lose")
- Formula: `loss_amount * losing_rate`
- Distribution: Split across ancestor chain
- Applies to: Casino, Slot, Mini Game only

## Commission Policy Priority
1. Agent-specific override (`commission_overrides` table)
2. Category-specific policy (e.g., casino rolling = 0.5%)
3. Generic policy (fallback, no category specified)

## Key Tables
- `commission_policies`: Rate definitions per game category
- `commission_overrides`: Agent-specific rate overrides
- `commission_ledger`: Transaction log of all commissions
- `settlements`: Periodic settlement aggregation

## Calculation Flow
```
Bet Event → commission_engine.calculate_rolling()
  → Find policy (override > category > generic)
  → Get ancestor chain via closure table
  → Create ledger entry per ancestor (status=pending)

Game Result (lose) → commission_engine.calculate_losing()
  → Same flow but only for losing rounds
```

## Settlement Flow
```
Create Settlement (date range)
  → Aggregate pending ledger entries
  → Preview API (dry run)
  → Confirm → status=confirmed
  → Pay → Update agent balance + status=paid
```

## Important Rules
- Duplicate prevention: `round_id` uniqueness check on webhooks
- Losing commission: ONLY on loss results, never on wins
- Settlement: Must preview before confirm, must confirm before pay
- Balance: Atomic updates required (race condition prevention)
