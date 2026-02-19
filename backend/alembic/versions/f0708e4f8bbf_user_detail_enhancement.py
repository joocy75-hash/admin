"""user_detail_enhancement

Revision ID: f0708e4f8bbf
Revises: a1b2c3d4e5f6
Create Date: 2026-02-18 15:05:23.623185
"""
from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
import sqlmodel

from alembic import op

revision: str = 'f0708e4f8bbf'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('nickname', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True))
    op.add_column('users', sa.Column('color', sqlmodel.sql.sqltypes.AutoString(length=7), nullable=True))
    op.add_column('users', sa.Column('password_hash', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True))
    op.add_column('users', sa.Column('registration_ip', sqlmodel.sql.sqltypes.AutoString(length=45), nullable=True))
    op.add_column('users', sa.Column('virtual_account_bank', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True))
    op.add_column('users', sa.Column('virtual_account_number', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True))
    op.add_column('users', sa.Column('total_deposit', sa.Numeric(precision=18, scale=2), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('total_withdrawal', sa.Numeric(precision=18, scale=2), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('total_bet', sa.Numeric(precision=18, scale=2), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('total_win', sa.Numeric(precision=18, scale=2), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('login_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('last_deposit_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('last_bet_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'last_bet_at')
    op.drop_column('users', 'last_deposit_at')
    op.drop_column('users', 'login_count')
    op.drop_column('users', 'total_win')
    op.drop_column('users', 'total_bet')
    op.drop_column('users', 'total_withdrawal')
    op.drop_column('users', 'total_deposit')
    op.drop_column('users', 'virtual_account_number')
    op.drop_column('users', 'virtual_account_bank')
    op.drop_column('users', 'registration_ip')
    op.drop_column('users', 'password_hash')
    op.drop_column('users', 'color')
    op.drop_column('users', 'nickname')
