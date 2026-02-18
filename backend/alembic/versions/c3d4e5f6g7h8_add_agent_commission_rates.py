"""Add agent_commission_rates table for hierarchical commission distribution.

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-02-18 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c3d4e5f6g7h8"
down_revision: Union[str, None] = "b2c3d4e5f6g7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_commission_rates'"
    ))
    if result.fetchone():
        return

    op.create_table(
        "agent_commission_rates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("admin_users.id"), nullable=False),
        sa.Column("game_category", sa.String(50), nullable=False),
        sa.Column("commission_type", sa.String(20), nullable=False),
        sa.Column("rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.Integer(), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.UniqueConstraint("agent_id", "game_category", "commission_type"),
    )
    op.create_index("ix_agent_commission_rates_agent_id", "agent_commission_rates", ["agent_id"])


def downgrade() -> None:
    op.drop_index("ix_agent_commission_rates_agent_id")
    op.drop_table("agent_commission_rates")
