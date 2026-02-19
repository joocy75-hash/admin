"""P1 features: Notifications, Fraud Detection System (FDS).

New tables:
- admin_notifications: Admin notification inbox
- fraud_alerts: Fraud detection alerts
- fraud_rules: Configurable fraud detection rules

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-02-18 23:30:00.000000

"""
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "g7h8i9j0k1l2"
down_revision: Union[str, None] = "f6g7h8i9j0k1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Admin Notifications
    op.create_table(
        "admin_notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("admin_user_id", sa.Integer(), sa.ForeignKey("admin_users.id"), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text()),
        sa.Column("data", JSONB),
        sa.Column("is_read", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("priority", sa.String(20), server_default="'normal'", nullable=False),
        sa.Column("link", sa.String(500)),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_admin_notifications_admin_user_id", "admin_notifications", ["admin_user_id"])
    op.create_index("ix_admin_notifications_type", "admin_notifications", ["type"])
    op.create_index("ix_admin_notifications_is_read", "admin_notifications", ["is_read"])
    op.create_index("ix_admin_notifications_priority", "admin_notifications", ["priority"])
    op.create_index("ix_admin_notifications_created_at", "admin_notifications", ["created_at"])

    # 2. Fraud Alerts
    op.create_table(
        "fraud_alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("alert_type", sa.String(30), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), server_default="'open'", nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("data", JSONB),
        sa.Column("detected_at", sa.DateTime(), nullable=False),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("admin_users.id")),
        sa.Column("reviewed_at", sa.DateTime()),
        sa.Column("resolution_note", sa.Text()),
    )
    op.create_index("ix_fraud_alerts_user_id", "fraud_alerts", ["user_id"])
    op.create_index("ix_fraud_alerts_alert_type", "fraud_alerts", ["alert_type"])
    op.create_index("ix_fraud_alerts_severity", "fraud_alerts", ["severity"])
    op.create_index("ix_fraud_alerts_status", "fraud_alerts", ["status"])
    op.create_index("ix_fraud_alerts_detected_at", "fraud_alerts", ["detected_at"])

    # 3. Fraud Rules
    op.create_table(
        "fraud_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("rule_type", sa.String(30), nullable=False),
        sa.Column("condition", JSONB),
        sa.Column("severity", sa.String(20), server_default="'medium'", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("admin_users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_fraud_rules_rule_type", "fraud_rules", ["rule_type"])
    op.create_index("ix_fraud_rules_is_active", "fraud_rules", ["is_active"])


def downgrade() -> None:
    op.drop_table("fraud_rules")
    op.drop_table("fraud_alerts")
    op.drop_table("admin_notifications")
