"""P2 features: IP restrictions, admin memos.

New tables:
- ip_restrictions: IP whitelist/blacklist management
- admin_memos: Admin memo history for users/agents/transactions

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-02-18 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "h8i9j0k1l2m3"
down_revision: Union[str, None] = "g7h8i9j0k1l2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. IP Restrictions
    op.create_table(
        "ip_restrictions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=False),
        sa.Column("description", sa.String(200)),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("admin_users.id")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_ip_restrictions_type", "ip_restrictions", ["type"])
    op.create_index("ix_ip_restrictions_ip_address", "ip_restrictions", ["ip_address"])

    # 2. Admin Memos
    op.create_table(
        "admin_memos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("admin_users.id")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_admin_memos_target", "admin_memos", ["target_type", "target_id"])


def downgrade() -> None:
    op.drop_table("admin_memos")
    op.drop_table("ip_restrictions")
