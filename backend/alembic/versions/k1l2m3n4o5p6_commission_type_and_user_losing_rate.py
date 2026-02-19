"""Add commission_type and losing_rate to users table.

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-02-19
"""
import sqlalchemy as sa

from alembic import op

revision = "k1l2m3n4o5p6"
down_revision = "j0k1l2m3n4o5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # commission_type: 'rolling' or 'losing' (mutually exclusive)
    op.add_column("users", sa.Column("commission_type", sa.String(10), nullable=False, server_default="rolling"))
    # Single losing_rate for the user (not per-game), max 50%
    op.add_column("users", sa.Column("losing_rate", sa.Numeric(5, 2), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "losing_rate")
    op.drop_column("users", "commission_type")
