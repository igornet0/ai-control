"""add favorite files table

Revision ID: add_favorite_files_table
Revises: 405fd6725f21
Create Date: 2025-08-31 14:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_favorite_files_table'
down_revision = '405fd6725f21'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create favorite_files table
    op.create_table('favorite_files',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('project_id', sa.BigInteger(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('added_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'project_id', 'filename', name='uq_user_project_filename')
    )
    
    # Create indexes
    op.create_index('idx_favorite_files_user_id', 'favorite_files', ['user_id'])
    op.create_index('idx_favorite_files_project_filename', 'favorite_files', ['project_id', 'filename'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_favorite_files_project_filename', table_name='favorite_files')
    op.drop_index('idx_favorite_files_user_id', table_name='favorite_files')
    
    # Drop table
    op.drop_table('favorite_files')
