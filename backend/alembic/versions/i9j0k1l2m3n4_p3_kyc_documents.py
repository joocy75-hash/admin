"""P3 features: KYC document verification.

New tables:
- kyc_documents: User identity verification documents

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-02-18 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "i9j0k1l2m3n4"
down_revision: Union[str, None] = "h8i9j0k1l2m3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "kyc_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("document_type", sa.String(30), nullable=False),
        sa.Column("document_number", sa.String(50)),
        sa.Column("front_image_url", sa.String(500)),
        sa.Column("back_image_url", sa.String(500)),
        sa.Column("selfie_image_url", sa.String(500)),
        sa.Column("status", sa.String(20), server_default="'pending'", nullable=False),
        sa.Column("rejection_reason", sa.String(500)),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("admin_users.id")),
        sa.Column("reviewed_at", sa.DateTime()),
        sa.Column("expires_at", sa.DateTime()),
        sa.Column("submitted_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_kyc_documents_user_id", "kyc_documents", ["user_id"])
    op.create_index("ix_kyc_documents_status", "kyc_documents", ["status"])


def downgrade() -> None:
    op.drop_table("kyc_documents")
