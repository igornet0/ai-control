"""
Роутер для управления проектами
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload, joinedload
from datetime import datetime, timezone, date
from pydantic import BaseModel

from backend.api.configuration.server import Server
from core.database.models import Project, ProjectTeam, ProjectStatus, ProjectPriority, User, Task, Team, TeamMember
from core.database.models.project_model import ProjectAttachmentFavorite
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
    task_ids: Optional[List[int]] = None  # ID задач для привязки к проекту


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


class TeamMemberResponse(BaseModel):
    user_id: int
    username: str
    role: str
    is_active: bool


class ProjectTeamResponse(BaseModel):
    id: int
    team_id: int
    team_name: str
    role: str
    joined_at: datetime
    disbanded_at: Optional[date]
    is_active: bool
    members: List[TeamMemberResponse]


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
    updated_by: Optional[int] = None
    updated_by_username: Optional[str] = None
    manager_name: Optional[str]
    organization_name: Optional[str]
    department_name: Optional[str]
    task_count: int
    team_count: int
    tasks: List[ProjectTaskResponse]
    teams: List[ProjectTeamResponse]
    attachments: Optional[List[dict]] = None


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
        selectinload(Project.teams).selectinload(ProjectTeam.team).selectinload(Team.members).selectinload(TeamMember.user),
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
            # Получаем участников команды
            team_members: List[TeamMemberResponse] = []
            for member in pt.team.members:
                team_members.append(TeamMemberResponse(
                    user_id=member.user_id,
                    username=member.user.username,
                    role=member.role,
                    is_active=member.is_active
                ))
            
            teams.append(ProjectTeamResponse(
                id=pt.id,
                team_id=pt.team_id,
                team_name=pt.team.name,
                role=pt.role,
                joined_at=pt.joined_at,
                disbanded_at=pt.disbanded_at,
                is_active=pt.is_active,
                members=team_members
            ))

        # Получаем имя пользователя, который обновил проект
        updated_by_username = None
        if project.updated_by:
            updated_user_result = await session.execute(select(User).where(User.id == project.updated_by))
            updated_user = updated_user_result.scalar_one_or_none()
            updated_by_username = updated_user.username if updated_user else None

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
            updated_by=project.updated_by,
            updated_by_username=updated_by_username,
            manager_name=project.manager.username if project.manager else None,
            organization_name=project.organization.name if project.organization else None,
            department_name=project.department.name if project.department else None,
            task_count=task_count,
            team_count=team_count,
            tasks=tasks,
            teams=teams,
            attachments=(project.custom_fields or {}).get("attachments") if project.custom_fields else None
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
        selectinload(Project.teams).selectinload(ProjectTeam.team).selectinload(Team.members).selectinload(TeamMember.user),
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
        # Конвертируем disbanded_at в date, если он есть
        disbanded_date = None
        if pt.disbanded_at:
            if isinstance(pt.disbanded_at, datetime):
                disbanded_date = pt.disbanded_at.date()
            else:
                disbanded_date = pt.disbanded_at
        
        # Получаем участников команды
        team_members: List[TeamMemberResponse] = []
        for member in pt.team.members:
            team_members.append(TeamMemberResponse(
                user_id=member.user_id,
                username=member.user.username,
                role=member.role,
                is_active=member.is_active
            ))
        
        teams.append(ProjectTeamResponse(
            id=pt.id,
            team_id=pt.team_id,
            team_name=pt.team.name,
            role=pt.role,
            joined_at=pt.joined_at,
            disbanded_at=disbanded_date,
            is_active=pt.is_active,
            members=team_members
        ))

    # Получаем имя пользователя, который обновил проект
    updated_by_username = None
    if project.updated_by:
        updated_user_result = await session.execute(select(User).where(User.id == project.updated_by))
        updated_user = updated_user_result.scalar_one_or_none()
        updated_by_username = updated_user.username if updated_user else None

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
        updated_by=project.updated_by,
        updated_by_username=updated_by_username,
        manager_name=project.manager.username if project.manager else None,
        organization_name=project.organization.name if project.organization else None,
        department_name=project.department.name if project.department else None,
        task_count=task_count,
        team_count=team_count,
        tasks=tasks,
        teams=teams,
        attachments=(project.custom_fields or {}).get("attachments") if project.custom_fields else None
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

    # Привязываем существующие задачи к проекту, если указаны
    if project_data.task_ids:
        for task_id in project_data.task_ids:
            task_result = await session.execute(select(Task).where(Task.id == task_id))
            task = task_result.scalar_one_or_none()
            if task:
                task.project_id = project.id
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

    # Устанавливаем информацию о том, кто и когда обновил проект
    project.updated_by = current_user.id
    project.updated_at = datetime.now()

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
    from core.database.models.task_model import TaskUserNote
    
    query = select(Project).where(Project.id == project_id)
    result = await session.execute(query)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Проверяем права на удаление
    if project.manager_id != current_user.id and current_user.role not in ['admin', 'CEO']:
        raise HTTPException(status_code=403, detail="Not enough permissions to delete this project")

    try:
        # Сначала отвязываем задачи от проекта (НЕ удаляем задачи!)
        
        # 1. Получаем все задачи проекта
        project_tasks_query = select(Task).where(Task.project_id == project_id)
        project_tasks_result = await session.execute(project_tasks_query)
        project_tasks = project_tasks_result.scalars().all()
        
        # 2. Отвязываем задачи от проекта (задачи остаются в системе)
        for task in project_tasks:
            task.project_id = None
            await session.merge(task)
        
        # 3. Удаляем заметки пользователей только для тех задач, которые не имеют других связей
        # (Заметки остаются, так как задачи остаются)
        
        # 4. Теперь можно безопасно удалить проект (задачи НЕ удаляются)
        await session.delete(project)
        await session.commit()
        
        return {"message": "Project deleted successfully"}
        
    except Exception as e:
        await session.rollback()
        print(f"Error deleting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting project: {str(e)}")


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

    # Set disbanded_at date only (without time) instead of deleting
    existing.disbanded_at = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    existing.is_active = False
    await session.commit()
    return {"message": "Team removed from project"}



@router.get("/{project_id}/attachments")
async def list_project_attachments(
    project_id: int,
    search: Optional[str] = None,
    sort_by: str = "name",  # name | size | type
    sort_order: str = "asc",
    only_my: bool = False,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    result = await session.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    cf = project.custom_fields or {}
    attachments = cf.get("attachments", [])

    # Фильтрация
    if search:
        q = search.lower()
        attachments = [a for a in attachments if q in (a.get("filename", "").lower())]
    if only_my:
        attachments = [a for a in attachments if a.get("uploaded_by") == current_user.id]

    # Избранное
    fav_rows = await session.execute(
        select(ProjectAttachmentFavorite.filename).where(
            ProjectAttachmentFavorite.project_id == project_id,
            ProjectAttachmentFavorite.user_id == current_user.id
        )
    )
    fav_set = set([r[0] for r in fav_rows.fetchall()])

    # Обогащаем
    def key_fn(a):
        if sort_by == "size":
            return a.get("size", 0)
        if sort_by == "type":
            return (a.get("content_type") or "")
        return (a.get("filename") or "")

    reverse = sort_order == "desc"
    attachments.sort(key=key_fn, reverse=reverse)

    # Ограничение количества
    if limit and limit > 0:
        attachments = attachments[:limit]

    for a in attachments:
        a["is_favorite"] = a.get("filename") in fav_set

    return {"items": attachments, "total": len(attachments)}


@router.get("/attachments")
async def list_all_project_attachments(
    search: Optional[str] = None,
    sort_by: str = "uploaded_at",  # uploaded_at | name | size | type
    sort_order: str = "desc",
    only_my: bool = False,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Получить список всех файлов проектов"""
    try:
        print(f"DEBUG: current_user = {current_user}")
        print(f"DEBUG: current_user.id = {current_user.id if current_user else 'None'}")
        print(f"DEBUG: Parameters - search={search}, sort_by={sort_by}, sort_order={sort_order}, only_my={only_my}, limit={limit}")
        
        # Получаем проекты (минимальный набор полей)
        proj_res = await session.execute(select(Project))
        projects = proj_res.scalars().all()
        print(f"DEBUG: Found {len(projects)} projects")

        # Получаем избранные файлы пользователя
        from core.database.models.document_model import FavoriteFile
        fav_query = select(FavoriteFile).where(FavoriteFile.user_id == current_user.id)
        fav_result = await session.execute(fav_query)
        favorites = fav_result.scalars().all()
        print(f"DEBUG: Found {len(favorites)} favorite files")
        
        # Создаем набор избранных файлов для быстрого поиска
        favorite_files = {(fav.project_id, fav.filename) for fav in favorites}

        rows: list[dict] = []
        for p in projects:
            cf = p.custom_fields or {}
            atts = cf.get("attachments", []) or []
            for a in atts:
                # фильтр only_my
                if only_my and a.get("uploaded_by") != current_user.id:
                    continue
                rec = {
                    "project_id": p.id,
                    "project_name": p.name,
                    "filename": a.get("filename"),
                    "content_type": a.get("content_type"),
                    "size": a.get("size"),
                    "uploaded_by": a.get("uploaded_by"),
                    "uploaded_at": a.get("uploaded_at"),
                    "is_favorite": (p.id, a.get("filename")) in favorite_files
                }
                rows.append(rec)

        print(f"DEBUG: Found {len(rows)} files total")

        # Поиск
        if search:
            q = search.lower()
            rows = [r for r in rows if q in (r.get("filename") or "").lower() or q in (r.get("project_name") or "").lower()]
            print(f"DEBUG: After search filter: {len(rows)} files")

        # Сортировка
        def key_fn(r: dict):
            if sort_by == "size":
                return r.get("size") or 0
            if sort_by == "type":
                return r.get("content_type") or ""
            if sort_by == "name":
                return r.get("filename") or ""
            # uploaded_at
            return r.get("uploaded_at") or ""

        reverse = sort_order == "desc"
        rows.sort(key=key_fn, reverse=reverse)

        total = len(rows)
        if limit and limit > 0:
            rows = rows[:limit]

        print(f"DEBUG: Returning {len(rows)} files")
        return {"items": rows, "total": len(rows)}
        
    except Exception as e:
        print(f"ERROR in list_all_project_attachments: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{project_id}/attachments/{filename}/favorite")
async def toggle_favorite_attachment(
    project_id: int,
    filename: str,
    favorite: bool = True,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    # Ensure project exists
    res = await session.execute(select(Project.id).where(Project.id == project_id))
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    if favorite:
        # add or ignore
        exists = await session.execute(
            select(ProjectAttachmentFavorite.id).where(
                ProjectAttachmentFavorite.user_id == current_user.id,
                ProjectAttachmentFavorite.project_id == project_id,
                ProjectAttachmentFavorite.filename == filename
            )
        )
        if exists.scalar_one_or_none() is None:
            session.add(ProjectAttachmentFavorite(
                user_id=current_user.id,
                project_id=project_id,
                filename=filename
            ))
            await session.commit()
        return {"message": "added"}
    else:
        await session.execute(
            ProjectAttachmentFavorite.__table__.delete().where(
                (ProjectAttachmentFavorite.user_id == current_user.id) &
                (ProjectAttachmentFavorite.project_id == project_id) &
                (ProjectAttachmentFavorite.filename == filename)
            )
        )
        await session.commit()
        return {"message": "removed"}


@router.get("/{project_id}/attachments/{filename}")
async def download_project_attachment(
    project_id: int,
    filename: str,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    # Найдем вложение в custom_fields
    result = await session.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    cf = project.custom_fields or {}
    attachments = cf.get("attachments", [])
    found = next((a for a in attachments if a.get("filename") == filename), None)
    if not found:
        raise HTTPException(status_code=404, detail="Attachment not found")

    from fastapi.responses import FileResponse
    return FileResponse(path=found["path"], media_type=found.get("content_type") or "application/octet-stream", filename=found["filename"])


@router.post("/{project_id}/tasks/{task_id}")
async def add_existing_task_to_project(
    project_id: int,
    task_id: int,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Привязать существующую задачу к проекту (установить project_id у Task)."""
    proj_res = await session.execute(select(Project).where(Project.id == project_id))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.manager_id != current_user.id and current_user.role not in ['admin', 'CEO']:
        raise HTTPException(status_code=403, detail="Not enough permissions to modify this project")

    task_res = await session.execute(select(Task).where(Task.id == task_id))
    task = task_res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.project_id = project.id
    await session.commit()
    return {"message": "Task linked to project"}


@router.delete("/{project_id}/tasks/{task_id}")
async def remove_task_from_project(
    project_id: int,
    task_id: int,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Отвязать задачу от проекта (project_id = NULL)."""
    proj_res = await session.execute(select(Project).where(Project.id == project_id))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.manager_id != current_user.id and current_user.role not in ['admin', 'CEO']:
        raise HTTPException(status_code=403, detail="Not enough permissions to modify this project")

    task_res = await session.execute(select(Task).where(Task.id == task_id))
    task = task_res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.project_id != project.id:
        raise HTTPException(status_code=400, detail="Task does not belong to this project")

    task.project_id = None
    await session.commit()
    return {"message": "Task unlinked from project"}


@router.post("/{project_id}/attachments")
async def upload_project_attachments(
    project_id: int,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Загрузить файлы в проект"""
    # Проверяем существование проекта
    query = select(Project).where(Project.id == project_id)
    result = await session.execute(query)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Проверяем права доступа
    if project.manager_id != current_user.id and current_user.role not in ['admin', 'CEO']:
        raise HTTPException(status_code=403, detail="Not enough permissions to upload files to this project")

    import os
    from pathlib import Path
    
    # Создаем директорию для файлов проекта
    upload_dir = Path(f"uploads/projects/{project_id}")
    upload_dir.mkdir(parents=True, exist_ok=True)

    uploaded_files = []
    
    for file in files:
        # Сохраняем файл
        file_path = upload_dir / file.filename
        
        # Записываем файл
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        uploaded_files.append({
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(content),
            "path": str(file_path)
        })

    # Сохраняем информацию о файлах в custom_fields проекта
    if not project.custom_fields:
        project.custom_fields = {}
    
    if "attachments" not in project.custom_fields:
        project.custom_fields["attachments"] = []
    
    project.custom_fields["attachments"].extend(uploaded_files)
    
    # Обновляем проект
    await session.commit()
    await session.refresh(project)

    return {
        "message": f"Successfully uploaded {len(files)} files",
        "files": uploaded_files
    }


@router.get("/{project_id}/attachments/{filename}")
async def download_project_attachment(
    project_id: int,
    filename: str,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Скачать файл из проекта"""
    from fastapi.responses import FileResponse
    import os
    from pathlib import Path
    
    # Проверяем существование проекта
    query = select(Project).where(Project.id == project_id)
    result = await session.execute(query)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Проверяем права доступа (можем расширить логику доступа)
    if project.manager_id != current_user.id and current_user.role not in ['admin', 'CEO']:
        # Проверяем, является ли пользователь участником команды проекта
        is_team_member = False
        if project.teams:
            for project_team in project.teams:
                team = project_team.team
                if team and team.members:
                    for member in team.members:
                        if member.user_id == current_user.id and member.is_active:
                            is_team_member = True
                            break
                if is_team_member:
                    break
        
        if not is_team_member:
            raise HTTPException(status_code=403, detail="Not enough permissions to download files from this project")

    # Путь к файлу
    file_path = Path(f"uploads/projects/{project_id}/{filename}")
    
    # Проверяем существование файла
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Проверяем, что файл действительно принадлежит проекту
    if project.custom_fields and "attachments" in project.custom_fields:
        file_exists_in_project = False
        for attachment in project.custom_fields["attachments"]:
            if attachment.get("filename") == filename:
                file_exists_in_project = True
                break
        
        if not file_exists_in_project:
            raise HTTPException(status_code=404, detail="File not found in project")
    else:
        raise HTTPException(status_code=404, detail="No attachments found in project")

    # Возвращаем файл для скачивания
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type='application/octet-stream'
    )


# ==================== ИЗБРАННЫЕ ФАЙЛЫ ====================

@router.post("/{project_id}/attachments/{filename}/favorite")
async def add_file_to_favorites(
    project_id: int,
    filename: str,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Добавить файл в избранное"""
    from core.database.models.document_model import FavoriteFile
    from sqlalchemy.exc import IntegrityError
    
    # Проверяем существование проекта
    query = select(Project).where(Project.id == project_id)
    result = await session.execute(query)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Проверяем существование файла в проекте
    cf = project.custom_fields or {}
    attachments = cf.get("attachments", [])
    file_exists = any(a.get("filename") == filename for a in attachments)
    
    if not file_exists:
        raise HTTPException(status_code=404, detail="File not found in project")
    
    try:
        # Создаем запись избранного файла
        favorite = FavoriteFile(
            user_id=current_user.id,
            project_id=project_id,
            filename=filename
        )
        session.add(favorite)
        await session.commit()
        
        return {"message": "File added to favorites"}
        
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="File is already in favorites")
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Error adding file to favorites: {str(e)}")


@router.delete("/{project_id}/attachments/{filename}/favorite")
async def remove_file_from_favorites(
    project_id: int,
    filename: str,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Удалить файл из избранного"""
    from core.database.models.document_model import FavoriteFile
    
    # Находим запись избранного файла
    query = select(FavoriteFile).where(
        FavoriteFile.user_id == current_user.id,
        FavoriteFile.project_id == project_id,
        FavoriteFile.filename == filename
    )
    result = await session.execute(query)
    favorite = result.scalar_one_or_none()
    
    if not favorite:
        raise HTTPException(status_code=404, detail="File not found in favorites")
    
    try:
        await session.delete(favorite)
        await session.commit()
        
        return {"message": "File removed from favorites"}
        
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Error removing file from favorites: {str(e)}")


@router.get("/favorites/attachments")
async def list_favorite_files(
    search: Optional[str] = None,
    sort_by: str = "added_at",  # added_at | name | size | type
    sort_order: str = "desc",
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Получить список избранных файлов пользователя"""
    from core.database.models.document_model import FavoriteFile
    
    # Получаем избранные файлы пользователя
    query = select(FavoriteFile).options(
        selectinload(FavoriteFile.project)
    ).where(FavoriteFile.user_id == current_user.id)
    
    result = await session.execute(query)
    favorites = result.scalars().all()
    
    # Собираем информацию о файлах
    rows: list[dict] = []
    for fav in favorites:
        project = fav.project
        if not project:
            continue
            
        cf = project.custom_fields or {}
        attachments = cf.get("attachments", []) or []
        
        # Находим файл в attachments проекта
        for a in attachments:
            if a.get("filename") == fav.filename:
                rows.append({
                    "project_id": project.id,
                    "project_name": project.name,
                    "filename": a.get("filename", ""),
                    "content_type": a.get("content_type", ""),
                    "size": a.get("size", 0),
                    "uploaded_by": a.get("uploaded_by", ""),
                    "uploaded_at": a.get("uploaded_at", ""),
                    "added_to_favorites_at": fav.added_at.isoformat() if fav.added_at else "",
                    "is_favorite": True
                })
                break
    
    # Фильтрация по поиску
    if search:
        search_lower = search.lower()
        rows = [r for r in rows if search_lower in r["filename"].lower()]
    
    # Сортировка
    reverse = sort_order.lower() == "desc"
    if sort_by == "name":
        rows.sort(key=lambda x: x["filename"].lower(), reverse=reverse)
    elif sort_by == "size":
        rows.sort(key=lambda x: x["size"] or 0, reverse=reverse)
    elif sort_by == "type":
        rows.sort(key=lambda x: x["content_type"].lower(), reverse=reverse)
    elif sort_by == "added_at":
        rows.sort(key=lambda x: x["added_to_favorites_at"], reverse=reverse)
    else:  # default: added_at
        rows.sort(key=lambda x: x["added_to_favorites_at"], reverse=reverse)
    
    # Ограничение количества
    if limit > 0:
        rows = rows[:limit]
    
    return {"items": rows, "total": len(rows)}
