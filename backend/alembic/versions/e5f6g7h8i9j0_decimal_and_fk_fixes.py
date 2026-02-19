"""Convert float columns to Numeric and add missing foreign keys.

- game_rounds.bet_amount: FLOAT → NUMERIC(18, 2)
- game_rounds.win_amount: FLOAT → NUMERIC(18, 2)
- agent_salary_configs.base_rate: FLOAT → NUMERIC(18, 2)
- agent_salary_configs.min_threshold: FLOAT → NUMERIC(18, 2)
- transactions.user_id: add FK → users.id
- commission_ledger.user_id: add FK → users.id
- game_rounds.user_id: add FK → users.id

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-02-18 22:00:00.000000

"""
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

revision: str = "e5f6g7h8i9j0"
down_revision: Union[str, None] = "d4e5f6g7h8i9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Convert float → Numeric(18, 2)
    op.alter_column(
        "game_rounds", "bet_amount",
        existing_type=sa.Float(),
        type_=sa.Numeric(precision=18, scale=2),
        existing_nullable=False,
    )
    op.alter_column(
        "game_rounds", "win_amount",
        existing_type=sa.Float(),
        type_=sa.Numeric(precision=18, scale=2),
        existing_nullable=False,
    )
    op.alter_column(
        "agent_salary_configs", "base_rate",
        existing_type=sa.Float(),
        type_=sa.Numeric(precision=18, scale=2),
        existing_nullable=False,
    )
    op.alter_column(
        "agent_salary_configs", "min_threshold",
        existing_type=sa.Float(),
        type_=sa.Numeric(precision=18, scale=2),
        existing_nullable=False,
    )

    # 2. Add missing foreign keys
    op.create_foreign_key(
        "fk_transactions_user_id",
        "transactions", "users",
        ["user_id"], ["id"],
    )
    op.create_foreign_key(
        "fk_commission_ledger_user_id",
        "commission_ledger", "users",
        ["user_id"], ["id"],
    )
    op.create_foreign_key(
        "fk_game_rounds_user_id",
        "game_rounds", "users",
        ["user_id"], ["id"],
    )


def downgrade() -> None:
    # Remove foreign keys
    op.drop_constraint("fk_game_rounds_user_id", "game_rounds", type_="foreignkey")
    op.drop_constraint("fk_commission_ledger_user_id", "commission_ledger", type_="foreignkey")
    op.drop_constraint("fk_transactions_user_id", "transactions", type_="foreignkey")

    # Revert Numeric → Float
    op.alter_column(
        "agent_salary_configs", "min_threshold",
        existing_type=sa.Numeric(precision=18, scale=2),
        type_=sa.Float(),
        existing_nullable=False,
    )
    op.alter_column(
        "agent_salary_configs", "base_rate",
        existing_type=sa.Numeric(precision=18, scale=2),
        type_=sa.Float(),
        existing_nullable=False,
    )
    op.alter_column(
        "game_rounds", "win_amount",
        existing_type=sa.Numeric(precision=18, scale=2),
        type_=sa.Float(),
        existing_nullable=False,
    )
    op.alter_column(
        "game_rounds", "bet_amount",
        existing_type=sa.Numeric(precision=18, scale=2),
        type_=sa.Float(),
        existing_nullable=False,
    )
