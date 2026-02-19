"""Add promotion/reward feature tables: attendance, spin, payback, deposit_bonus, point_config, exchange_rate, popup, mission, admin_login_log.

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-02-20
"""
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "l2m3n4o5p6q7"
down_revision = "k1l2m3n4o5p6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attendance_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("day_number", sa.Integer, nullable=False, unique=True),
        sa.Column("reward_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("reward_type", sa.String(10), nullable=False, server_default="cash"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "spin_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, server_default="기본 룰렛"),
        sa.Column("prizes", JSONB, nullable=False, server_default="[]"),
        sa.Column("max_spins_daily", sa.Integer, nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "payback_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("payback_percent", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("payback_type", sa.String(10), nullable=False, server_default="cash"),
        sa.Column("period", sa.String(10), nullable=False, server_default="daily"),
        sa.Column("min_loss_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("max_payback_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "deposit_bonus_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("bonus_percent", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("max_bonus_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("min_deposit_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("rollover_multiplier", sa.Integer, nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "point_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("key", sa.String(50), nullable=False, unique=True),
        sa.Column("value", sa.String(255), nullable=False, server_default=""),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "exchange_rates",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("pair", sa.String(20), nullable=False, unique=True),
        sa.Column("rate", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("source", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "popup_notices",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("display_type", sa.String(20), nullable=False, server_default="always"),
        sa.Column("target", sa.String(20), nullable=False, server_default="all"),
        sa.Column("priority", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "missions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("rules", sa.Text, nullable=True),
        sa.Column("type", sa.String(20), nullable=False, server_default="daily"),
        sa.Column("bonus_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("max_participants", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "admin_login_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("admin_user_id", sa.Integer, sa.ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("device", sa.String(50), nullable=True),
        sa.Column("os", sa.String(50), nullable=True),
        sa.Column("browser", sa.String(50), nullable=True),
        sa.Column("logged_in_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("admin_login_logs")
    op.drop_table("missions")
    op.drop_table("popup_notices")
    op.drop_table("exchange_rates")
    op.drop_table("point_configs")
    op.drop_table("deposit_bonus_configs")
    op.drop_table("payback_configs")
    op.drop_table("spin_configs")
    op.drop_table("attendance_configs")
