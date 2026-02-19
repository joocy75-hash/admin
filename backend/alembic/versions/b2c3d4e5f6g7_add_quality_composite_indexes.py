"""Add composite indexes for quality improvements.

Revision ID: b2c3d4e5f6g7
Revises: f0708e4f8bbf
Create Date: 2026-02-18 20:00:00.000000
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "b2c3d4e5f6g7"
down_revision: Union[str, None] = "f0708e4f8bbf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # transactions: (user_id, status) - user transaction filtering by status
    op.create_index(
        "ix_transactions_user_id_status", "transactions", ["user_id", "status"]
    )

    # commission_ledger: (agent_id, created_at, status) - settlement period queries
    op.create_index(
        "ix_commission_ledger_agent_created_status",
        "commission_ledger",
        ["agent_id", "created_at", "status"],
    )

    # bet_records: (user_id, created_at) - user betting history
    op.create_index(
        "ix_bet_records_user_id_created_at", "bet_records", ["user_id", "created_at"]
    )

    # money_logs: (user_id, created_at) - user money history
    op.create_index(
        "ix_money_logs_user_id_created_at", "money_logs", ["user_id", "created_at"]
    )

    # point_logs: (user_id, created_at) - user point history
    op.create_index(
        "ix_point_logs_user_id_created_at", "point_logs", ["user_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_point_logs_user_id_created_at", table_name="point_logs")
    op.drop_index("ix_money_logs_user_id_created_at", table_name="money_logs")
    op.drop_index("ix_bet_records_user_id_created_at", table_name="bet_records")
    op.drop_index(
        "ix_commission_ledger_agent_created_status", table_name="commission_ledger"
    )
    op.drop_index("ix_transactions_user_id_status", table_name="transactions")
