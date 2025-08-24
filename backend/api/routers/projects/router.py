"""
Роутер для управления проектами
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload, joinedload
from datetime import datetime, timezone
from pydantic import BaseModel

from backend.api.configuration.server import Server
from core.database.models import Project, ProjectTeam, ProjectStatus, ProjectPriority, User, Task, Team
from backend.api.configuration.auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["projects"])


# Схемы запросов и ответов
class ProjectCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.PLANNING
    priority: ProjectPriority = ProjectPriority.MEDIUM
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    organization_id: Optional[int] = None
    department_id: Optional[int] = None
    manager_id: Optional[int] = None
    budget: Optional[float] = None
    tags: Optional[List[str]] = None
    team_ids: Optional[List[int]] = None  # ID команд для добавления в проект


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[ProjectPriority] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    budget: Optional[float] = None
    progress: Optional[int] = None
    tags: Optional[List[str]] = None


class ProjectTeamResponse(BaseModel):
    id: int
    team_id: int
    team_name: str
    role: str
    joined_at: datetime
    is_active: bool


class ProjectTaskResponse(BaseModel):
    id: int
    title: str
    status: str
    priority: str
    executor_name: Optional[str]
    due_date: Optional[datetime]
    progress_percentage: int


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: ProjectStatus
    priority: ProjectPriority
    start_date: Optional[datetime]
    due_date: Optional[datetime]
    completed_at: Optional[datetime]
    budget: Optional[float]
    progress: int
    tags: Optional[List[str]]
    created_at: datetime
    updated_at: datetime
    manager_name: Optional[str]
    organization_name: Optional[str]
    department_name: Optional[str]
    task_count: int
    team_count: int
    tasks: List[ProjectTaskResponse]
    teams: List[ProjectTeamResponse]


def _to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    # Если дата с таймзоной, приводим к UTC и убираем tzinfo
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


@router.get("/", response_model=List[ProjectResponse])
async def get_projects(
    search: Optional[str] = None,
    status: Optional[ProjectStatus] = None,
    priority: Optional[ProjectPriority] = None,
    organization_id: Optional[int] = None,
    department_id: Optional[int] = None,
    manager_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Получить список проектов с фильтрацией"""
    query = select(Project).options(
        selectinload(Project.tasks).selectinload(Task.executor),
        selectinload(Project.teams).selectinload(ProjectTeam.team),
        joinedload(Project.manager),
        joinedload(Project.organization),
        joinedload(Project.department)
    )

    filters = []
    if search:
        filters.append(Project.name.ilike(f"%{search}%"))
    if status:
        filters.append(Project.status == status)
    if priority:
        filters.append(Project.priority == priority)
    if organization_id:
        filters.append(Project.organization_id == organization_id)
    if department_id:
        filters.append(Project.department_id == department_id)
    if manager_id:
        filters.append(Project.manager_id == manager_id)

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(Project.created_at.desc())

    result = await session.execute(query)
    projects = result.scalars().unique().all()

    responses: List[ProjectResponse] = []
    for project in projects:
        task_count = len(project.tasks)
        team_count = len(project.teams)

        tasks: List[ProjectTaskResponse] = []
        for task in project.tasks:
            tasks.append(ProjectTaskResponse(
                id=task.id,
                title=task.title,
                status=task.status,
                priority=task.priority,
                executor_name=task.executor.username if task.executor else None,
                due_date=task.due_date,
                progress_percentage=task.progress_percentage
            ))

        teams: List[ProjectTeamResponse] = []
        for pt in project.teams:
            teams.append(ProjectTeamResponse(
                id=pt.id,
                team_id=pt.team_id,
                team_name=pt.team.name,
                role=pt.role,
                joined_at=pt.joined_at,
                is_active=pt.is_active
            ))

        responses.append(ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            status=project.status,
            priority=project.priority,
            start_date=project.start_date,
            due_date=project.due_date,
            completed_at=project.completed_at,
            budget=project.budget,
            progress=project.progress,
            tags=project.tags,
            created_at=project.created_at,
            updated_at=project.updated_at,
            manager_name=project.manager.username if project.manager else None,
            organization_name=project.organization.name if project.organization else None,
            department_name=project.department.name if project.department else None,
            task_count=task_count,
            team_count=team_count,
            tasks=tasks,
            teams=teams
        ))

    return responses


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Получить проект по ID"""
    query = select(Project).where(Project.id == project_id).options(
        selectinload(Project.tasks).selectinload(Task.executor),
        selectinload(Project.teams).selectinload(ProjectTeam.team),
        joinedload(Project.manager),
        joinedload(Project.organization),
        joinedload(Project.department)
    )

    result = await session.execute(query)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    task_count = len(project.tasks)
    team_count = len(project.teams)

    tasks: List[ProjectTaskResponse] = []
    for task in project.tasks:
        tasks.append(ProjectTaskResponse(
            id=task.id,
            title=task.title,
            status=task.status,
            priority=task.priority,
            executor_name=task.executor.username if task.executor else None,
            due_date=task.due_date,
            progress_percentage=task.progress_percentage
        ))

    teams: List[ProjectTeamResponse] = []
    for pt in project.teams:
        teams.append(ProjectTeamResponse(
            id=pt.id,
            team_id=pt.team_id,
            team_name=pt.team.name,
            role=pt.role,
            joined_at=pt.joined_at,
            is_active=pt.is_active
        ))

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        priority=project.priority,
        start_date=project.start_date,
        due_date=project.due_date,
        completed_at=project.completed_at,
        budget=project.budget,
        progress=project.progress,
        tags=project.tags,
        created_at=project.created_at,
        updated_at=project.updated_at,
        manager_name=project.manager.username if project.manager else None,
        organization_name=project.organization.name if project.organization else None,
        department_name=project.department.name if project.department else None,
        task_count=task_count,
        team_count=team_count,
        tasks=tasks,
        teams=teams
    )


@router.post("/", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreateRequest,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Создать новый проект"""
    # Нормализуем даты к наивным (UTC без tzinfo)
    start_date = _to_naive_utc(project_data.start_date)
    due_date = _to_naive_utc(project_data.due_date)

    project = Project(
        name=project_data.name,
        description=project_data.description,
        status=project_data.status,
        priority=project_data.priority,
        start_date=start_date,
        due_date=due_date,
        organization_id=project_data.organization_id,
        department_id=project_data.department_id,
        manager_id=project_data.manager_id or current_user.id,
        budget=project_data.budget,
        tags=project_data.tags
    )

    session.add(project)
    await session.commit()
    await session.refresh(project)

    # Добавляем команды в проект, если указаны
    if project_data.team_ids:
        for team_id in project_data.team_ids:
            team_result = await session.execute(select(Team).where(Team.id == team_id))
            team = team_result.scalar_one_or_none()
            if team:
                project_team = ProjectTeam(
                    project_id=project.id,
                    team_id=team_id,
                    role="development"
                )
                session.add(project_team)
        await session.commit()

    return await get_project(project.id, current_user, session)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_data: ProjectUpdateRequest,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Обновить проект"""
    query = select(Project).where(Project.id == project_id)
    result = await session.execute(query)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Проверяем права на редактирование
    if project.manager_id != current_user.id and current_user.role not in ['admin', 'CEO']:
        raise HTTPException(status_code=403, detail="Not enough permissions to edit this project")

    # Обновляем поля с нормализацией дат
    update_data = project_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field in ("start_date", "due_date", "completed_at"):
            value = _to_naive_utc(value)
        setattr(project, field, value)

    # Если проект завершен, устанавливаем дату завершения
    if project.status == ProjectStatus.COMPLETED and not project.completed_at:
        project.completed_at = datetime.now()

    await session.commit()
    await session.refresh(project)

    return await get_project(project.id, current_user, session)


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Удалить проект"""
    query = select(Project).where(Project.id == project_id)
    result = await session.execute(query)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Проверяем права на удаление
    if project.manager_id != current_user.id and current_user.role not in ['admin', 'CEO']:
        raise HTTPException(status_code=403, detail="Not enough permissions to delete this project")

    await session.delete(project)
    await session.commit()

    return {"message": "Project deleted successfully"}


@router.post("/{project_id}/teams")
async def add_team_to_project(
    project_id: int,
    team_id: int,
    role: str = "development",
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Добавить команду в проект"""
    project_result = await session.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.manager_id != current_user.id and current_user.role not in ['admin', 'CEO']:
        raise HTTPException(status_code=403, detail="Not enough permissions to modify this project")

    team_result = await session.execute(select(Team).where(Team.id == team_id))
    team = team_result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    existing_result = await session.execute(
        select(ProjectTeam).where(
            and_(ProjectTeam.project_id == project_id, ProjectTeam.team_id == team_id)
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=400, detail="Team is already in this project")

    project_team = ProjectTeam(
        project_id=project_id,
        team_id=team_id,
        role=role
    )
    session.add(project_team)
    await session.commit()

    return {"message": "Team added to project"}


@router.delete("/{project_id}/teams/{team_id}")
async def remove_team_from_project(
    project_id: int,
    team_id: int,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Удалить команду из проекта"""
    project_result = await session.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.manager_id != current_user.id and current_user.role not in ['admin', 'CEO']:
        raise HTTPException(status_code=403, detail="Not enough permissions to modify this project")

    existing_result = await session.execute(
        select(ProjectTeam).where(
            and_(ProjectTeam.project_id == project_id, ProjectTeam.team_id == team_id)
        )
    )
    existing = existing_result.scalar_one_or_none()

    if not existing:
        raise HTTPException(status_code=404, detail="Team is not in this project")

    await session.delete(existing)
    await session.commit()

    return {"message": "Team removed from project"}
