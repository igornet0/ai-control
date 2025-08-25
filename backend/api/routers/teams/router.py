"""
Роутер для управления командами
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload, joinedload
from datetime import datetime, timezone
from pydantic import BaseModel

from backend.api.configuration.server import Server
from core.database.models import Team, TeamMember, TeamRole, TeamStatus, User, Task
from backend.api.configuration.auth import get_current_user

router = APIRouter(prefix="/api/teams", tags=["teams"])


def _to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

# Схемы запросов и ответов
class TeamCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False
    auto_disband_date: Optional[datetime] = None
    organization_id: Optional[int] = None
    department_id: Optional[int] = None
    tags: Optional[List[str]] = None
    member_ids: Optional[List[int]] = None


class TeamUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None
    auto_disband_date: Optional[datetime] = None
    status: Optional[TeamStatus] = None
    tags: Optional[List[str]] = None


class TeamMemberAddRequest(BaseModel):
    user_id: int
    role: TeamRole = TeamRole.MEMBER
    permissions: Optional[dict] = None


class TeamMemberResponse(BaseModel):
    id: int
    user_id: int
    username: str
    role: TeamRole
    joined_at: datetime
    is_active: bool


class TeamTaskResponse(BaseModel):
    id: int
    title: str
    status: str
    priority: str
    due_date: Optional[datetime]


class TeamResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: TeamStatus
    is_public: bool
    auto_disband_date: Optional[datetime]
    organization_id: Optional[int]
    department_id: Optional[int]
    tags: Optional[List[str]]
    created_at: datetime
    updated_at: datetime
    member_count: int
    members: List[TeamMemberResponse]
    tasks: List[TeamTaskResponse]


@router.get("/", response_model=List[TeamResponse])
async def get_teams(
    search: Optional[str] = None,
    status: Optional[TeamStatus] = None,
    organization_id: Optional[int] = None,
    department_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Получить список команд с фильтрацией"""
    query = select(Team).options(
        selectinload(Team.members).selectinload(TeamMember.user),
        selectinload(Team.organization),
        selectinload(Team.department)
    )
    
    # Применяем фильтры
    filters = []
    
    if search:
        filters.append(
            or_(
                Team.name.ilike(f"%{search}%"),
                Team.description.ilike(f"%{search}%")
            )
        )
    
    if status:
        filters.append(Team.status == status)
    
    if organization_id:
        filters.append(Team.organization_id == organization_id)
    
    if department_id:
        filters.append(Team.department_id == department_id)
    
    # Показываем только публичные команды или команды, где пользователь является участником
    if filters:
        query = query.where(and_(*filters))
    
    # Добавляем фильтр по доступности
    query = query.where(
        or_(
            Team.is_public == True,
            Team.members.any(and_(TeamMember.user_id == current_user.id, TeamMember.is_active == True))
        )
    )
    
    result = await session.execute(query)
    teams = result.scalars().unique().all()
    
    # Формируем ответ
    response_teams = []
    for team in teams:
        # Получаем задачи команды
        tasks_query = select(Task).where(
            or_(
                Task.organization_id == team.organization_id,
                Task.department_id == team.department_id
            )
        )
        tasks_result = await session.execute(tasks_query)
        tasks = tasks_result.scalars().all()
        
        team_data = TeamResponse(
            id=team.id,
            name=team.name,
            description=team.description,
            status=team.status,
            is_public=team.is_public,
            auto_disband_date=team.auto_disband_date,
            organization_id=team.organization_id,
            department_id=team.department_id,
            tags=team.tags,
            created_at=team.created_at,
            updated_at=team.updated_at,
            member_count=len([m for m in team.members if m.is_active]),
            members=[
                TeamMemberResponse(
                    id=member.id,
                    user_id=member.user_id,
                    username=member.user.username,
                    role=member.role,
                    joined_at=member.joined_at,
                    is_active=member.is_active
                )
                for member in team.members if member.is_active
            ],
            tasks=[
                TeamTaskResponse(
                    id=task.id,
                    title=task.title,
                    status=task.status,
                    priority=task.priority,
                    due_date=task.due_date
                )
                for task in tasks
            ]
        )
        response_teams.append(team_data)
    
    return response_teams


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: int,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Получить информацию о команде"""
    query = select(Team).options(
        selectinload(Team.members).selectinload(TeamMember.user),
        selectinload(Team.organization),
        selectinload(Team.department)
    ).where(Team.id == team_id)
    
    result = await session.execute(query)
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Проверяем доступ
    if not team.is_public and not any(
        m.user_id == current_user.id and m.is_active 
        for m in team.members
    ):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Получаем задачи команды
    tasks_query = select(Task).where(
        or_(
            Task.organization_id == team.organization_id,
            Task.department_id == team.department_id
        )
    )
    tasks_result = await session.execute(tasks_query)
    tasks = tasks_result.scalars().all()
    
    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        status=team.status,
        is_public=team.is_public,
        auto_disband_date=team.auto_disband_date,
        organization_id=team.organization_id,
        department_id=team.department_id,
        tags=team.tags,
        created_at=team.created_at,
        updated_at=team.updated_at,
        member_count=len([m for m in team.members if m.is_active]),
        members=[
            TeamMemberResponse(
                id=member.id,
                user_id=member.user_id,
                username=member.user.username,
                role=member.role,
                joined_at=member.joined_at,
                is_active=member.is_active
            )
            for member in team.members if member.is_active
        ],
        tasks=[
            TeamTaskResponse(
                id=task.id,
                title=task.title,
                status=task.status,
                priority=task.priority,
                due_date=task.due_date
            )
            for task in tasks
        ]
    )


@router.post("/", response_model=TeamResponse)
async def create_team(
    team_data: TeamCreateRequest,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Создать новую команду"""
    # Нормализуем дату расформирования
    auto_date = _to_naive_utc(team_data.auto_disband_date)

    # Создаем команду
    team = Team(
        name=team_data.name,
        description=team_data.description,
        is_public=team_data.is_public,
        auto_disband_date=auto_date,
        organization_id=team_data.organization_id,
        department_id=team_data.department_id,
        tags=team_data.tags
    )
    
    session.add(team)
    await session.flush()  # Получаем ID команды
    
    # Добавляем создателя как владельца
    owner_member = TeamMember(
        team_id=team.id,
        user_id=current_user.id,
        role=TeamRole.OWNER
    )
    session.add(owner_member)
    
    # Добавляем других участников, если указаны
    if team_data.member_ids:
        for user_id in team_data.member_ids:
            if user_id != current_user.id:  # Не добавляем создателя повторно
                member = TeamMember(
                    team_id=team.id,
                    user_id=user_id,
                    role=TeamRole.MEMBER
                )
                session.add(member)
    
    await session.commit()
    await session.refresh(team)
    
    # Возвращаем созданную команду
    return await get_team(team.id, current_user, session)


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: int,
    team_data: TeamUpdateRequest,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Обновить команду"""
    query = select(Team).where(Team.id == team_id)
    result = await session.execute(query)
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Проверяем права на редактирование
    member_query = select(TeamMember).where(
        and_(TeamMember.team_id == team_id, TeamMember.user_id == current_user.id)
    )
    member_result = await session.execute(member_query)
    member = member_result.scalar_one_or_none()
    
    if not member or member.role not in [TeamRole.OWNER, TeamRole.LEADER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Обновляем поля
    if team_data.name is not None:
        team.name = team_data.name
    if team_data.description is not None:
        team.description = team_data.description
    if team_data.is_public is not None:
        team.is_public = team_data.is_public
    if team_data.auto_disband_date is not None:
        team.auto_disband_date = _to_naive_utc(team_data.auto_disband_date)
    if team_data.status is not None:
        team.status = team_data.status
    if team_data.tags is not None:
        team.tags = team_data.tags
    
    team.updated_at = datetime.now()
    
    await session.commit()
    await session.refresh(team)
    
    return await get_team(team.id, current_user, session)


@router.delete("/{team_id}")
async def delete_team(
    team_id: int,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Удалить команду"""
    query = select(Team).where(Team.id == team_id)
    result = await session.execute(query)
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Проверяем права на удаление
    member_query = select(TeamMember).where(
        and_(TeamMember.team_id == team_id, TeamMember.user_id == current_user.id)
    )
    member_result = await session.execute(member_query)
    member = member_result.scalar_one_or_none()
    
    if not member or member.role != TeamRole.OWNER:
        raise HTTPException(status_code=403, detail="Only team owner can delete team")
    
    # Удаляем команду (каскадно удалятся все участники)
    await session.delete(team)
    await session.commit()
    
    return {"message": "Team deleted successfully"}


@router.post("/{team_id}/members")
async def add_team_member(
    team_id: int,
    member_data: TeamMemberAddRequest,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Добавить участника в команду"""
    # Проверяем существование команды
    team_query = select(Team).where(Team.id == team_id)
    team_result = await session.execute(team_query)
    team = team_result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Проверяем права на добавление участников
    member_query = select(TeamMember).where(
        and_(TeamMember.team_id == team_id, TeamMember.user_id == current_user.id)
    )
    member_result = await session.execute(member_query)
    member = member_result.scalar_one_or_none()
    
    if not member or member.role not in [TeamRole.OWNER, TeamRole.LEADER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Проверяем, не является ли пользователь уже участником
    existing_member_query = select(TeamMember).where(
        and_(TeamMember.team_id == team_id, TeamMember.user_id == member_data.user_id)
    )
    existing_member_result = await session.execute(existing_member_query)
    existing_member = existing_member_result.scalar_one_or_none()
    
    if existing_member:
        raise HTTPException(status_code=400, detail="User is already a team member")
    
    # Добавляем участника
    new_member = TeamMember(
        team_id=team_id,
        user_id=member_data.user_id,
        role=member_data.role,
        permissions=member_data.permissions
    )
    
    session.add(new_member)
    await session.commit()
    
    return {"message": "Team member added successfully"}


@router.delete("/{team_id}/members/{user_id}")
async def remove_team_member(
    team_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Удалить участника из команды"""
    # Проверяем существование команды
    team_query = select(Team).where(Team.id == team_id)
    team_result = await session.execute(team_query)
    team = team_result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Проверяем права на удаление участников
    member_query = select(TeamMember).where(
        and_(TeamMember.team_id == team_id, TeamMember.user_id == current_user.id)
    )
    member_result = await session.execute(member_query)
    member = member_result.scalar_one_or_none()
    
    if not member or member.role not in [TeamRole.OWNER, TeamRole.LEADER]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Проверяем, что не удаляем владельца команды
    target_member_query = select(TeamMember).where(
        and_(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
    )
    target_member_result = await session.execute(target_member_query)
    target_member = target_member_result.scalar_one_or_none()
    
    if not target_member:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    if target_member.role == TeamRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot remove team owner")
    
    # Удаляем участника
    await session.delete(target_member)
    await session.commit()
    
    return {"message": "Team member removed successfully"}


@router.get("/search/users")
async def search_users_for_team(
    search: str,
    current_user: User = Depends(get_current_user),
    session = Depends(Server.get_db)
):
    """Поиск пользователей для добавления в команду"""
    query = select(User).where(
        and_(
            User.is_active == True,
            or_(
                User.username.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%")
            )
        )
    ).limit(20)
    
    result = await session.execute(query)
    users = result.scalars().all()
    
    return [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "position": user.position
        }
        for user in users
    ]
