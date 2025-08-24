"""Add team management models

Revision ID: add_team_management_models
Revises: 405fd6725f21
Create Date: 2025-01-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_team_management_models'
down_revision = '405fd6725f21'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create teams table
    op.create_table('teams',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('is_public', sa.Boolean(), nullable=False, default=False),
        sa.Column('auto_disband_date', sa.DateTime(), nullable=True),
        sa.Column('disbanded_at', sa.DateTime(), nullable=True),
        sa.Column('organization_id', sa.BigInteger(), nullable=True),
        sa.Column('department_id', sa.BigInteger(), nullable=True),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('custom_fields', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for teams table
    op.create_index('idx_teams_status', 'teams', ['status'])
    op.create_index('idx_teams_organization', 'teams', ['organization_id'])
    op.create_index('idx_teams_department', 'teams', ['department_id'])
    op.create_index('idx_teams_auto_disband', 'teams', ['auto_disband_date'])
    op.create_index('idx_teams_name', 'teams', ['name'])
    
    # Create team_members table
    op.create_table('team_members',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('team_id', sa.BigInteger(), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('permissions', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_muted', sa.Boolean(), nullable=False, default=False),
        sa.Column('notifications_enabled', sa.Boolean(), nullable=False, default=True),
        sa.Column('sound_enabled', sa.Boolean(), nullable=False, default=True),
        sa.Column('joined_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('left_at', sa.DateTime(), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(), nullable=True),
        sa.Column('last_read_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for team_members table
    op.create_index('idx_team_members_team_id', 'team_members', ['team_id'])
    op.create_index('idx_team_members_user_id', 'team_members', ['user_id'])
    op.create_index('idx_team_members_role', 'team_members', ['role'])
    op.create_index('idx_team_members_active', 'team_members', ['is_active'])
    
    # Create unique constraint for team_members
    op.create_unique_constraint('uq_team_member', 'team_members', ['team_id', 'user_id'])
    
    # Add foreign key constraints
    op.create_foreign_key(
        'fk_teams_organization_id', 'teams',
        'organizations', ['organization_id'], ['id']
    )
    op.create_foreign_key(
        'fk_teams_department_id', 'teams',
        'departments', ['department_id'], ['id']
    )
    op.create_foreign_key(
        'fk_team_members_team_id', 'team_members',
        'teams', ['team_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_team_members_user_id', 'team_members',
        'users', ['user_id'], ['id'], ondelete='CASCADE'
    )


def downgrade() -> None:
    # Remove foreign key constraints
    op.drop_constraint('fk_team_members_user_id', 'team_members', type_='foreignkey')
    op.drop_constraint('fk_team_members_team_id', 'team_members', type_='foreignkey')
    op.drop_constraint('fk_teams_department_id', 'teams', type_='foreignkey')
    op.drop_constraint('fk_teams_organization_id', 'teams', type_='foreignkey')
    
    # Remove unique constraint
    op.drop_constraint('uq_team_member', 'team_members', type_='unique')
    
    # Drop indexes
    op.drop_index('idx_team_members_active', table_name='team_members')
    op.drop_index('idx_team_members_role', table_name='team_members')
    op.drop_index('idx_team_members_user_id', table_name='team_members')
    op.drop_index('idx_team_members_team_id', table_name='team_members')
    op.drop_index('idx_teams_name', table_name='teams')
    op.drop_index('idx_teams_auto_disband', table_name='teams')
    op.drop_index('idx_teams_department', table_name='teams')
    op.drop_index('idx_teams_organization', table_name='teams')
    op.drop_index('idx_teams_status', table_name='teams')
    
    # Drop tables
    op.drop_table('team_members')
    op.drop_table('teams')
