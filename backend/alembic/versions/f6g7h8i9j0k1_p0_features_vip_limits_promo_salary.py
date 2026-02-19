"""P0 features: VIP levels, transaction/betting limits, promotions, salary payments.

New tables:
- vip_levels: VIP tier definitions with benefits
- user_level_history: Level change audit trail
- transaction_limits: Deposit/withdrawal limits (global/vip/user scope)
- betting_limits: Min/max bet per game category (global/vip/user scope)
- promotions: Bonus/event/promo definitions
- user_promotions: User participation in promotions
- coupons: Redeemable coupon codes
- user_coupons: Coupon usage records
- agent_salary_payments: Salary payment history

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-02-18 23:00:00.000000

"""
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "f6g7h8i9j0k1"
down_revision: Union[str, None] = "e5f6g7h8i9j0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. VIP Levels
    op.create_table(
        "vip_levels",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("level", sa.Integer(), unique=True, nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("min_total_deposit", sa.Numeric(18, 2), server_default="0"),
        sa.Column("min_total_bet", sa.Numeric(18, 2), server_default="0"),
        sa.Column("rolling_bonus_rate", sa.Numeric(5, 2), server_default="0"),
        sa.Column("losing_bonus_rate", sa.Numeric(5, 2), server_default="0"),
        sa.Column("deposit_limit_daily", sa.Numeric(18, 2), server_default="0"),
        sa.Column("withdrawal_limit_daily", sa.Numeric(18, 2), server_default="0"),
        sa.Column("withdrawal_limit_monthly", sa.Numeric(18, 2), server_default="0"),
        sa.Column("max_single_bet", sa.Numeric(18, 2), server_default="0"),
        sa.Column("benefits", JSONB, server_default="{}", nullable=False),
        sa.Column("color", sa.String(7)),
        sa.Column("icon", sa.String(50)),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_vip_levels_level", "vip_levels", ["level"])

    # 2. User Level History
    op.create_table(
        "user_level_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("from_level", sa.Integer(), nullable=False),
        sa.Column("to_level", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(100), nullable=False),
        sa.Column("changed_by", sa.Integer(), sa.ForeignKey("admin_users.id")),
        sa.Column("changed_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_user_level_history_user_id", "user_level_history", ["user_id"])

    # 3. Transaction Limits
    op.create_table(
        "transaction_limits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scope_type", sa.String(20), nullable=False),
        sa.Column("scope_id", sa.Integer(), server_default="0"),
        sa.Column("tx_type", sa.String(20), nullable=False),
        sa.Column("min_amount", sa.Numeric(18, 2), server_default="0"),
        sa.Column("max_amount", sa.Numeric(18, 2), server_default="0"),
        sa.Column("daily_limit", sa.Numeric(18, 2), server_default="0"),
        sa.Column("daily_count", sa.Integer(), server_default="0"),
        sa.Column("monthly_limit", sa.Numeric(18, 2), server_default="0"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("updated_by", sa.Integer(), sa.ForeignKey("admin_users.id")),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("scope_type", "scope_id", "tx_type"),
    )
    op.create_index("ix_transaction_limits_scope_type", "transaction_limits", ["scope_type"])

    # 4. Betting Limits
    op.create_table(
        "betting_limits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scope_type", sa.String(20), nullable=False),
        sa.Column("scope_id", sa.Integer(), server_default="0"),
        sa.Column("game_category", sa.String(30), nullable=False),
        sa.Column("min_bet", sa.Numeric(18, 2), server_default="0"),
        sa.Column("max_bet", sa.Numeric(18, 2), server_default="0"),
        sa.Column("max_daily_loss", sa.Numeric(18, 2), server_default="0"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("updated_by", sa.Integer(), sa.ForeignKey("admin_users.id")),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("scope_type", "scope_id", "game_category"),
    )
    op.create_index("ix_betting_limits_scope_type", "betting_limits", ["scope_type"])

    # 5. Promotions
    op.create_table(
        "promotions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("bonus_type", sa.String(20), nullable=False),
        sa.Column("bonus_value", sa.Numeric(18, 2), server_default="0"),
        sa.Column("min_deposit", sa.Numeric(18, 2), server_default="0"),
        sa.Column("max_bonus", sa.Numeric(18, 2), server_default="0"),
        sa.Column("wagering_multiplier", sa.Integer(), server_default="1"),
        sa.Column("target", sa.String(20), server_default="'all'"),
        sa.Column("target_value", sa.String(50)),
        sa.Column("max_claims_per_user", sa.Integer(), server_default="1"),
        sa.Column("max_total_claims", sa.Integer(), server_default="0"),
        sa.Column("total_claimed", sa.Integer(), server_default="0"),
        sa.Column("rules", JSONB, server_default="{}", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("priority", sa.Integer(), server_default="0"),
        sa.Column("starts_at", sa.DateTime()),
        sa.Column("ends_at", sa.DateTime()),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("admin_users.id")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_promotions_type", "promotions", ["type"])
    op.create_index("ix_promotions_is_active", "promotions", ["is_active"])

    # 6. User Promotions
    op.create_table(
        "user_promotions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("promotion_id", sa.Integer(), sa.ForeignKey("promotions.id"), nullable=False),
        sa.Column("status", sa.String(20), server_default="'active'"),
        sa.Column("bonus_amount", sa.Numeric(18, 2), server_default="0"),
        sa.Column("wagering_required", sa.Numeric(18, 2), server_default="0"),
        sa.Column("wagering_completed", sa.Numeric(18, 2), server_default="0"),
        sa.Column("deposit_tx_id", sa.Integer()),
        sa.Column("claimed_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime()),
        sa.Column("completed_at", sa.DateTime()),
    )
    op.create_index("ix_user_promotions_user_id", "user_promotions", ["user_id"])
    op.create_index("ix_user_promotions_promotion_id", "user_promotions", ["promotion_id"])
    op.create_index("ix_user_promotions_status", "user_promotions", ["status"])

    # 7. Coupons
    op.create_table(
        "coupons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("promotion_id", sa.Integer(), sa.ForeignKey("promotions.id"), nullable=False),
        sa.Column("max_uses", sa.Integer(), server_default="1"),
        sa.Column("used_count", sa.Integer(), server_default="0"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("expires_at", sa.DateTime()),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("admin_users.id")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_coupons_code", "coupons", ["code"])
    op.create_index("ix_coupons_promotion_id", "coupons", ["promotion_id"])

    # 8. User Coupons
    op.create_table(
        "user_coupons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("coupon_id", sa.Integer(), sa.ForeignKey("coupons.id"), nullable=False),
        sa.Column("bonus_amount", sa.Numeric(18, 2), server_default="0"),
        sa.Column("used_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_user_coupons_user_id", "user_coupons", ["user_id"])
    op.create_index("ix_user_coupons_coupon_id", "user_coupons", ["coupon_id"])

    # 9. Agent Salary Payments
    op.create_table(
        "agent_salary_payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("admin_users.id"), nullable=False),
        sa.Column("config_id", sa.Integer(), sa.ForeignKey("agent_salary_configs.id"), nullable=False),
        sa.Column("salary_type", sa.String(20), nullable=False),
        sa.Column("period_start", sa.DateTime(), nullable=False),
        sa.Column("period_end", sa.DateTime(), nullable=False),
        sa.Column("base_amount", sa.Numeric(18, 2), server_default="0"),
        sa.Column("performance_bonus", sa.Numeric(18, 2), server_default="0"),
        sa.Column("deductions", sa.Numeric(18, 2), server_default="0"),
        sa.Column("total_amount", sa.Numeric(18, 2), server_default="0"),
        sa.Column("status", sa.String(20), server_default="'pending'"),
        sa.Column("memo", sa.Text()),
        sa.Column("approved_by", sa.Integer(), sa.ForeignKey("admin_users.id")),
        sa.Column("approved_at", sa.DateTime()),
        sa.Column("paid_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_agent_salary_payments_agent_id", "agent_salary_payments", ["agent_id"])
    op.create_index("ix_agent_salary_payments_status", "agent_salary_payments", ["status"])


def downgrade() -> None:
    op.drop_table("agent_salary_payments")
    op.drop_table("user_coupons")
    op.drop_table("coupons")
    op.drop_table("user_promotions")
    op.drop_table("promotions")
    op.drop_table("betting_limits")
    op.drop_table("transaction_limits")
    op.drop_table("user_level_history")
    op.drop_table("vip_levels")
