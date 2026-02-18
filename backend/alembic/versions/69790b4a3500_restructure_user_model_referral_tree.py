"""restructure_user_model_referral_tree

Revision ID: 69790b4a3500
Revises: 7656a57c4653
Create Date: 2026-02-18 07:53:56.456355
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = '69790b4a3500'
down_revision: Union[str, None] = '7656a57c4653'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create user_tree closure table
    op.create_table(
        'user_tree',
        sa.Column('ancestor_id', sa.Integer(), nullable=False),
        sa.Column('descendant_id', sa.Integer(), nullable=False),
        sa.Column('depth', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['ancestor_id'], ['users.id']),
        sa.ForeignKeyConstraint(['descendant_id'], ['users.id']),
        sa.PrimaryKeyConstraint('ancestor_id', 'descendant_id'),
    )

    # Add new columns with server defaults for existing rows
    op.add_column('users', sa.Column('referrer_id', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('depth', sa.Integer(), server_default='0', nullable=False))
    op.add_column('users', sa.Column('rank', sqlmodel.sql.sqltypes.AutoString(length=20), server_default='agency', nullable=False))
    op.add_column('users', sa.Column('points', sa.Numeric(precision=18, scale=2), server_default='0', nullable=False))

    # Update indexes
    op.drop_index(op.f('ix_users_agent_id'), table_name='users')
    op.create_index(op.f('ix_users_phone'), 'users', ['phone'], unique=False)
    op.create_index(op.f('ix_users_rank'), 'users', ['rank'], unique=False)
    op.create_index(op.f('ix_users_referrer_id'), 'users', ['referrer_id'], unique=False)

    # Replace agent_id FK with referrer_id self-FK
    op.drop_constraint(op.f('users_agent_id_fkey'), 'users', type_='foreignkey')
    op.create_foreign_key(None, 'users', 'users', ['referrer_id'], ['id'])
    op.drop_column('users', 'agent_id')

    # Migrate existing users: create self-reference closure table entries
    op.execute("""
        INSERT INTO user_tree (ancestor_id, descendant_id, depth)
        SELECT id, id, 0 FROM users
    """)


def downgrade() -> None:
    op.drop_table('user_tree')
    op.add_column('users', sa.Column('agent_id', sa.INTEGER(), autoincrement=False, nullable=True))
    op.drop_constraint(None, 'users', type_='foreignkey')
    op.create_foreign_key(op.f('users_agent_id_fkey'), 'users', 'admin_users', ['agent_id'], ['id'])
    op.drop_index(op.f('ix_users_referrer_id'), table_name='users')
    op.drop_index(op.f('ix_users_rank'), table_name='users')
    op.drop_index(op.f('ix_users_phone'), table_name='users')
    op.create_index(op.f('ix_users_agent_id'), 'users', ['agent_id'], unique=False)
    op.drop_column('users', 'points')
    op.drop_column('users', 'rank')
    op.drop_column('users', 'depth')
    op.drop_column('users', 'referrer_id')
