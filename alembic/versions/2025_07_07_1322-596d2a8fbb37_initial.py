"""Initial

Revision ID: 596d2a8fbb37
Revises: 
Create Date: 2025-07-07 13:22:28.206329

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '596d2a8fbb37'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('flows',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('created', sa.DateTime(), nullable=False),
    sa.Column('updated', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_flows'))
    )
    op.create_table('users',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('username', sa.String(length=255), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('role', sa.String(length=50), nullable=False),
    sa.Column('created', sa.DateTime(), nullable=False),
    sa.Column('updated', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
    sa.UniqueConstraint('email', name=op.f('uq_users_email')),
    sa.UniqueConstraint('username', name=op.f('uq_users_username'))
    )
    op.create_table('widget_types',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('description', sa.String(length=255), nullable=True),
    sa.Column('created', sa.DateTime(), nullable=False),
    sa.Column('updated', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_widget_types')),
    sa.UniqueConstraint('name', name=op.f('uq_widget_types_name'))
    )
    op.create_table('dashboards',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('owner_id', sa.BigInteger(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('created', sa.DateTime(), nullable=False),
    sa.Column('updated', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], name=op.f('fk_dashboards_owner_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_dashboards'))
    )
    op.create_table('group_users',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.String(length=500), nullable=True),
    sa.Column('owner_id', sa.BigInteger(), nullable=False),
    sa.Column('created', sa.DateTime(), nullable=False),
    sa.Column('updated', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], name=op.f('fk_group_users_owner_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_group_users'))
    )
    op.create_table('tasks',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.String(length=500), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=False),
    sa.Column('priority', sa.String(length=50), nullable=False),
    sa.Column('owner_id', sa.BigInteger(), nullable=False),
    sa.Column('executor_id', sa.BigInteger(), nullable=True),
    sa.Column('created', sa.DateTime(), nullable=False),
    sa.Column('updated', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['executor_id'], ['users.id'], name=op.f('fk_tasks_executor_id_users')),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], name=op.f('fk_tasks_owner_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_tasks'))
    )
    op.create_table('access_dashboards',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('dashboard_id', sa.BigInteger(), nullable=False),
    sa.Column('user_id', sa.BigInteger(), nullable=False),
    sa.Column('created', sa.DateTime(), nullable=False),
    sa.Column('updated', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['dashboard_id'], ['dashboards.id'], name=op.f('fk_access_dashboards_dashboard_id_dashboards')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_access_dashboards_user_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_access_dashboards'))
    )
    op.create_table('dashboard_datas',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('dashboard_id', sa.BigInteger(), nullable=False),
    sa.Column('data', sa.String(length=500), nullable=False),
    sa.Column('created', sa.DateTime(), nullable=False),
    sa.Column('updated', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['dashboard_id'], ['dashboards.id'], name=op.f('fk_dashboard_datas_dashboard_id_dashboards')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_dashboard_datas'))
    )
    op.create_table('flow_dashboards',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('flow_id', sa.BigInteger(), nullable=False),
    sa.Column('dashboard_id', sa.BigInteger(), nullable=False),
    sa.Column('created', sa.DateTime(), nullable=False),
    sa.Column('updated', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['dashboard_id'], ['dashboards.id'], name=op.f('fk_flow_dashboards_dashboard_id_dashboards')),
    sa.ForeignKeyConstraint(['flow_id'], ['flows.id'], name=op.f('fk_flow_dashboards_flow_id_flows')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_flow_dashboards'))
    )
    op.create_table('user_groups',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.BigInteger(), nullable=False),
    sa.Column('group_id', sa.BigInteger(), nullable=False),
    sa.Column('created', sa.DateTime(), nullable=False),
    sa.Column('updated', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['group_id'], ['group_users.id'], name=op.f('fk_user_groups_group_id_group_users')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_user_groups_user_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_user_groups'))
    )
    op.create_table('widgets',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('dashboard_id', sa.BigInteger(), nullable=False),
    sa.Column('widget_type_id', sa.BigInteger(), nullable=False),
    sa.Column('data', sa.String(length=500), nullable=True),
    sa.Column('created', sa.DateTime(), nullable=False),
    sa.Column('updated', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['dashboard_id'], ['dashboards.id'], name=op.f('fk_widgets_dashboard_id_dashboards')),
    sa.ForeignKeyConstraint(['widget_type_id'], ['widget_types.id'], name=op.f('fk_widgets_widget_type_id_widget_types')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_widgets'))
    )


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('widgets')
    op.drop_table('user_groups')
    op.drop_table('flow_dashboards')
    op.drop_table('dashboard_datas')
    op.drop_table('access_dashboards')
    op.drop_table('tasks')
    op.drop_table('group_users')
    op.drop_table('dashboards')
    op.drop_table('widget_types')
    op.drop_table('users')
    op.drop_table('flows')
    # ### end Alembic commands ###
