"""Add composite indexes for frequently used queries.

Revision ID: a1b2c3d4e5f6
Revises: 69790b4a3500
Create Date: 2026-02-18 12:00:00.000000
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "69790b4a3500"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Transactions: status + type (dashboard pending count, deposit/withdrawal listing)
    op.create_index("ix_transactions_status_type", "transactions", ["status", "type"])
    # Transactions: status + created_at (dashboard today totals)
    op.create_index("ix_transactions_status_created_at", "transactions", ["status", "created_at"])
    # Transactions: user_id + created_at (user transaction history)
    op.create_index("ix_transactions_user_id_created_at", "transactions", ["user_id", "created_at"])

    # Commission ledger: agent_id + status (settlement aggregation)
    op.create_index("ix_commission_ledger_agent_status", "commission_ledger", ["agent_id", "status"])
    # Commission ledger: type + created_at (dashboard today commission)
    op.create_index("ix_commission_ledger_type_created_at", "commission_ledger", ["type", "created_at"])

    # Game rounds: game_id + created_at (round listing per game)
    op.create_index("ix_game_rounds_game_id_created_at", "game_rounds", ["game_id", "created_at"])
    # Game rounds: user_id + created_at (round listing per user)
    op.create_index("ix_game_rounds_user_id_created_at", "game_rounds", ["user_id", "created_at"])

    # Games: category + is_active + sort_order (game listing with tabs)
    op.create_index("ix_games_category_active_sort", "games", ["category", "is_active", "sort_order"])

    # Audit logs: module + created_at (audit log filtering)
    op.create_index("ix_audit_logs_module_created_at", "audit_logs", ["module", "created_at"])

    # Admin users: status + role (dashboard agent count)
    op.create_index("ix_admin_users_status_role", "admin_users", ["status", "role"])


def downgrade() -> None:
    op.drop_index("ix_admin_users_status_role", table_name="admin_users")
    op.drop_index("ix_audit_logs_module_created_at", table_name="audit_logs")
    op.drop_index("ix_games_category_active_sort", table_name="games")
    op.drop_index("ix_game_rounds_user_id_created_at", table_name="game_rounds")
    op.drop_index("ix_game_rounds_game_id_created_at", table_name="game_rounds")
    op.drop_index("ix_commission_ledger_type_created_at", table_name="commission_ledger")
    op.drop_index("ix_commission_ledger_agent_status", table_name="commission_ledger")
    op.drop_index("ix_transactions_user_id_created_at", table_name="transactions")
    op.drop_index("ix_transactions_status_created_at", table_name="transactions")
    op.drop_index("ix_transactions_status_type", table_name="transactions")
