"""Add project management models

Revision ID: add_project_management_models
Revises: add_team_management_models
Create Date: 2025-01-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_project_management_models'
down_revision = 'add_team_management_models'
branch_labels = None
depends_on = None


def upgrade():
    # Создаем enum для статусов проектов
    op.execute("CREATE TYPE projectstatus AS ENUM ('planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived')")
    
    # Создаем enum для приоритетов проектов
    op.execute("CREATE TYPE projectpriority AS ENUM ('low', 'medium', 'high', 'critical', 'urgent')")
    
    # Создаем таблицу проектов
    op.create_table('projects',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', postgresql.ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived', name='projectstatus'), nullable=True),
        sa.Column('priority', postgresql.ENUM('low', 'medium', 'high', 'critical', 'urgent', name='projectpriority'), nullable=True),
        sa.Column('start_date', sa.DateTime(), nullable=True),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('organization_id', sa.BigInteger(), nullable=True),
        sa.Column('department_id', sa.BigInteger(), nullable=True),
        sa.Column('manager_id', sa.BigInteger(), nullable=True),
        sa.Column('budget', sa.BigInteger(), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=True),
        sa.Column('tags', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('custom_fields', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ),
        sa.ForeignKeyConstraint(['manager_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Создаем таблицу связей проектов с командами
    op.create_table('project_teams',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('project_id', sa.BigInteger(), nullable=False),
        sa.Column('team_id', sa.BigInteger(), nullable=False),
        sa.Column('role', sa.String(length=100), nullable=False),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Добавляем project_id в таблицу задач
    op.add_column('tasks', sa.Column('project_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key(None, 'tasks', 'projects', ['project_id'], ['id'])
    
    # Создаем индексы
    op.create_index('idx_projects_status', 'projects', ['status'])
    op.create_index('idx_projects_priority', 'projects', ['priority'])
    op.create_index('idx_projects_organization', 'projects', ['organization_id'])
    op.create_index('idx_projects_department', 'projects', ['department_id'])
    op.create_index('idx_projects_manager', 'projects', ['manager_id'])
    op.create_index('idx_projects_dates', 'projects', ['start_date', 'due_date'])
    op.create_index('idx_project_teams_project', 'project_teams', ['project_id'])
    op.create_index('idx_project_teams_team', 'project_teams', ['team_id'])
    op.create_index('idx_project_teams_active', 'project_teams', ['is_active'])
    op.create_index('idx_tasks_project', 'tasks', ['project_id'])


def downgrade():
    # Удаляем индексы
    op.drop_index('idx_tasks_project', table_name='tasks')
    op.drop_index('idx_project_teams_active', table_name='project_teams')
    op.drop_index('idx_project_teams_team', table_name='project_teams')
    op.drop_index('idx_project_teams_project', table_name='project_teams')
    op.drop_index('idx_projects_dates', table_name='projects')
    op.drop_index('idx_projects_manager', table_name='projects')
    op.drop_index('idx_projects_department', table_name='projects')
    op.drop_index('idx_projects_organization', table_name='projects')
    op.drop_index('idx_projects_priority', table_name='projects')
    op.drop_index('idx_projects_status', table_name='projects')
    
    # Удаляем project_id из таблицы задач
    op.drop_constraint(None, 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'project_id')
    
    # Удаляем таблицы
    op.drop_table('project_teams')
    op.drop_table('projects')
    
    # Удаляем enum типы
    op.execute("DROP TYPE projectpriority")
    op.execute("DROP TYPE projectstatus")
