"""Add losing_rate to user_game_rolling_rates and commission_enabled to users.

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-02-19 16:30:00.000000

"""

import sqlalchemy as sa

from alembic import op

revision = "j0k1l2m3n4o5"
down_revision = "i9j0k1l2m3n4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_game_rolling_rates",
        sa.Column("losing_rate", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "commission_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "commission_enabled")
    op.drop_column("user_game_rolling_rates", "losing_rate")
