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
from core.database.models import Project, ProjectTeam, ProjectStatus, ProjectPriority, User, Task, Team
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


class ProjectTeamResponse(BaseModel):
    id: int
    team_id: int
    team_name: str
    role: str
    joined_at: datetime
    disbanded_at: Optional[date]
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
                disbanded_at=pt.disbanded_at,
                is_active=pt.is_active
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
        # Конвертируем disbanded_at в date, если он есть
        disbanded_date = None
        if pt.disbanded_at:
            if isinstance(pt.disbanded_at, datetime):
                disbanded_date = pt.disbanded_at.date()
            else:
                disbanded_date = pt.disbanded_at
        
        teams.append(ProjectTeamResponse(
            id=pt.id,
            team_id=pt.team_id,
            team_name=pt.team.name,
            role=pt.role,
            joined_at=pt.joined_at,
            disbanded_at=disbanded_date,
            is_active=pt.is_active
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

    # Set disbanded_at date only (without time) instead of deleting
    existing.disbanded_at = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    existing.is_active = False
    await session.commit()
    return {"message": "Team removed from project"}


@router.post("/{project_id}/attachments", response_model=ProjectResponse)
async def upload_project_attachments(
    project_id: int,
    files: list[UploadFile] = File(default=None),
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Загрузить вложения для проекта. Допускаются: .pdf .doc .pages .csv .epub"""
    # Проверяем существование проекта и права
    result = await session.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.manager_id != current_user.id and current_user.role not in ['admin', 'CEO']:
        raise HTTPException(status_code=403, detail="Not enough permissions to modify this project")

    if not files:
        # Ничего не загружено — просто вернем проект
        return await get_project(project.id, current_user, session)

    import os
    from pathlib import Path

    allowed_ext = {".pdf", ".doc", ".pages", ".csv", ".cvs", ".epub"}
    base_dir = Path("/app/uploads/projects")
    base_dir.mkdir(parents=True, exist_ok=True)
    proj_dir = base_dir / str(project.id)
    proj_dir.mkdir(parents=True, exist_ok=True)

    attachments = []
    for f in files:
        name = f.filename or "upload"
        ext = os.path.splitext(name)[1].lower()
        if ext not in allowed_ext:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        target_path = proj_dir / name
        # Разрешим коллизии имен — допишем индекс
        idx = 1
        while target_path.exists():
            stem = os.path.splitext(name)[0]
            target_path = proj_dir / f"{stem}_{idx}{ext}"
            idx += 1

        content = await f.read()
        with open(target_path, "wb") as out:
            out.write(content)

        attachments.append({
            "filename": os.path.basename(target_path),
            "path": str(target_path),
            "content_type": f.content_type,
            "size": len(content),
            "uploaded_by": current_user.id,
            "uploaded_at": datetime.utcnow().isoformat()
        })

    # Сохраняем метаданные вложений в custom_fields.attachments
    cf = project.custom_fields or {}
    existing = cf.get("attachments", [])
    cf["attachments"] = existing + attachments
    project.custom_fields = cf

    await session.commit()
    await session.refresh(project)

    return await get_project(project.id, current_user, session)


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
    # Получаем проекты (минимальный набор полей)
    proj_res = await session.execute(select(Project))
    projects = proj_res.scalars().all()

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
            }
            rows.append(rec)

    # Поиск
    if search:
        q = search.lower()
        rows = [r for r in rows if q in (r.get("filename") or "").lower() or q in (r.get("project_name") or "").lower()]

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

    return {"items": rows, "total": total}


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
