"""Add project edit tracking

Revision ID: add_project_edit_tracking
Revises: add_project_management_models
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_project_edit_tracking'
down_revision = 'add_project_management_models'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add updated_by column to projects table
    op.add_column('projects', sa.Column('updated_by', sa.BigInteger(), nullable=True))
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_projects_updated_by_users',
        'projects', 'users',
        ['updated_by'], ['id']
    )
    
    # Add index for better performance
    op.create_index('idx_projects_updated_by', 'projects', ['updated_by'])


def downgrade() -> None:
    # Remove index
    op.drop_index('idx_projects_updated_by', 'projects')
    
    # Remove foreign key constraint
    op.drop_constraint('fk_projects_updated_by_users', 'projects', type_='foreignkey')
    
    # Remove column
    op.drop_column('projects', 'updated_by')
