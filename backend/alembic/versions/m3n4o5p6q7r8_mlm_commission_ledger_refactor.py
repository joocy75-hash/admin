"""MLM commission refactor: add recipient_user_id, game_category to commission_ledger.

Changes:
- Add recipient_user_id (FK → users.id) — the User who earns the commission
- Add game_category column for per-category tracking
- Make agent_id nullable (legacy/admin-override only)
- Make policy_id nullable (not always policy-driven)
- Drop old unique constraint, create new idempotency constraint
- Add indexes for new columns

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-02-20
"""
import sqlalchemy as sa

from alembic import op

revision = "m3n4o5p6q7r8"
down_revision = "l2m3n4o5p6q7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add recipient_user_id (nullable first, will backfill, then make NOT NULL)
    op.add_column(
        "commission_ledger",
        sa.Column("recipient_user_id", sa.Integer(), nullable=True),
    )

    # 2. Add game_category
    op.add_column(
        "commission_ledger",
        sa.Column("game_category", sa.String(50), nullable=True),
    )

    # 3. Backfill recipient_user_id from agent_id for existing rows
    # Try admin_users.username → users.username match, then user_id fallback.
    op.execute("""
        UPDATE commission_ledger cl
        SET recipient_user_id = COALESCE(
            (SELECT u.id FROM users u
             JOIN admin_users au ON au.username = u.username
             WHERE au.id = cl.agent_id
             LIMIT 1),
            CASE WHEN EXISTS (SELECT 1 FROM users u WHERE u.id = cl.user_id)
                 THEN cl.user_id ELSE NULL END
        )
        WHERE cl.recipient_user_id IS NULL
    """)

    # 3b. Delete orphaned rows that couldn't be mapped to any valid user
    op.execute("""
        DELETE FROM commission_ledger WHERE recipient_user_id IS NULL
    """)

    # 4. Make recipient_user_id NOT NULL after backfill
    op.alter_column(
        "commission_ledger", "recipient_user_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    # 5. Add FK constraint for recipient_user_id
    op.create_foreign_key(
        "fk_commission_ledger_recipient_user_id",
        "commission_ledger", "users",
        ["recipient_user_id"], ["id"],
    )

    # 6. Make agent_id nullable
    op.alter_column(
        "commission_ledger", "agent_id",
        existing_type=sa.Integer(),
        nullable=True,
    )

    # 7. Make policy_id nullable
    op.alter_column(
        "commission_ledger", "policy_id",
        existing_type=sa.Integer(),
        nullable=True,
    )

    # 8. Create indexes
    op.create_index(
        "ix_commission_ledger_recipient_user_id",
        "commission_ledger", ["recipient_user_id"],
    )
    op.create_index(
        "ix_commission_ledger_game_category",
        "commission_ledger", ["game_category"],
    )

    # 9. Create new idempotency constraint
    # (reference_id + user_id + type + recipient_user_id must be unique)
    op.create_unique_constraint(
        "uq_ledger_idempotency",
        "commission_ledger",
        ["reference_id", "user_id", "type", "recipient_user_id"],
    )


def downgrade() -> None:
    # Remove new unique constraint
    op.drop_constraint("uq_ledger_idempotency", "commission_ledger", type_="unique")

    # Drop indexes
    op.drop_index("ix_commission_ledger_game_category", table_name="commission_ledger")
    op.drop_index("ix_commission_ledger_recipient_user_id", table_name="commission_ledger")

    # Restore policy_id NOT NULL
    op.alter_column(
        "commission_ledger", "policy_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    # Restore agent_id NOT NULL
    op.alter_column(
        "commission_ledger", "agent_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    # Drop FK
    op.drop_constraint(
        "fk_commission_ledger_recipient_user_id",
        "commission_ledger", type_="foreignkey",
    )

    # Drop columns
    op.drop_column("commission_ledger", "game_category")
    op.drop_column("commission_ledger", "recipient_user_id")
