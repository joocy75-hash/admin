"""Convert bank-based payments to cryptocurrency-based system.

- Add user_wallet_addresses table (replaces user_bank_accounts)
- Add crypto fields to transactions (coin_type, network, tx_hash, wallet_address, confirmations)
- Replace virtual_account_bank/number with deposit_address/deposit_network on users

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-02-18 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d4e5f6g7h8i9"
down_revision: Union[str, None] = "c3d4e5f6g7h8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Create user_wallet_addresses table
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'user_wallet_addresses'"
    ))
    if not result.fetchone():
        op.create_table(
            "user_wallet_addresses",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("coin_type", sa.String(20), nullable=False),
            sa.Column("network", sa.String(20), nullable=False),
            sa.Column("address", sa.String(255), nullable=False),
            sa.Column("label", sa.String(100), nullable=True),
            sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_user_wallet_addresses_user_id", "user_wallet_addresses", ["user_id"])

    # 2. Add crypto fields to transactions (if not exist)
    for col_name, col_type in [
        ("coin_type", "VARCHAR(20)"),
        ("network", "VARCHAR(20)"),
        ("tx_hash", "VARCHAR(255)"),
        ("wallet_address", "VARCHAR(255)"),
        ("confirmations", "INTEGER"),
    ]:
        result = conn.execute(sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'transactions' AND column_name = :col"
        ), {"col": col_name})
        if not result.fetchone():
            op.add_column("transactions", sa.Column(col_name, sa.String(255) if "VARCHAR" in col_type else sa.Integer(), nullable=True))

    # Create index on tx_hash
    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname = 'ix_transactions_tx_hash'"
    ))
    if not result.fetchone():
        op.create_index("ix_transactions_tx_hash", "transactions", ["tx_hash"])

    # 3. Rename user columns: virtual_account_bank -> deposit_address, virtual_account_number -> deposit_network
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'users' AND column_name = 'virtual_account_bank'"
    ))
    if result.fetchone():
        op.alter_column("users", "virtual_account_bank", new_column_name="deposit_address", type_=sa.String(255))
        op.alter_column("users", "virtual_account_number", new_column_name="deposit_network", type_=sa.String(20))


def downgrade() -> None:
    # Reverse user column renames
    op.alter_column("users", "deposit_address", new_column_name="virtual_account_bank", type_=sa.String(50))
    op.alter_column("users", "deposit_network", new_column_name="virtual_account_number", type_=sa.String(50))

    # Remove crypto columns from transactions
    op.drop_index("ix_transactions_tx_hash")
    for col in ["confirmations", "wallet_address", "tx_hash", "network", "coin_type"]:
        op.drop_column("transactions", col)

    # Drop wallet addresses table
    op.drop_index("ix_user_wallet_addresses_user_id")
    op.drop_table("user_wallet_addresses")
