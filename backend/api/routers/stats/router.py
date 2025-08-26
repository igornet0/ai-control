"""
API статистики для пользователя
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.configuration.server import Server
from backend.api.configuration.auth import get_current_user
from core.database.models.task_model import Task, TaskStatus
from core.database.models.team_model import TeamMember, Team
from core.database.models.project_model import ProjectTeam, Project
from core.database.models.main_models import User

router = APIRouter(prefix="/api/stats", tags=["stats"])


def start_of_day(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/user")
async def get_user_stats(
    period_from: Optional[datetime] = Query(None),
    period_to: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(Server.get_db),
):
    now = datetime.utcnow()
    # buckets for completed tasks by executor
    day_start = start_of_day(now)
    week_start = start_of_day(now - timedelta(days=now.weekday()))  # Monday start
    month_start = start_of_day(now.replace(day=1))

    # Completed counts
    async def count_completed(since: Optional[datetime] = None) -> int:
        conditions = [Task.executor_id == current_user.id, Task.status == TaskStatus.COMPLETED]
        if since is not None:
            conditions.append(Task.completed_at >= since)
        res = await session.execute(select(func.count(Task.id)).where(and_(*conditions)))
        return int(res.scalar() or 0)

    completed_day = await count_completed(day_start)
    completed_week = await count_completed(week_start)
    completed_month = await count_completed(month_start)
    completed_all = await count_completed(None)

    # Overdue in a period: due_date in [period_from, period_to] and (completed_at is null or completed_at > due_date)
    overdue_count = 0
    if period_from or period_to:
        pf = period_from or (now - timedelta(days=30))
        pt = period_to or now
        res = await session.execute(
            select(func.count(Task.id)).where(
                and_(
                    Task.executor_id == current_user.id,
                    Task.due_date.isnot(None),
                    Task.due_date >= pf,
                    Task.due_date <= pt,
                    or_(
                        Task.completed_at.is_(None),
                        Task.completed_at > Task.due_date,
                    ),
                )
            )
        )
        overdue_count = int(res.scalar() or 0)

    # Team memberships
    res_tm = await session.execute(
        select(func.count(TeamMember.id)).where(and_(TeamMember.user_id == current_user.id, TeamMember.is_active == True))
    )
    teams_count = int(res_tm.scalar() or 0)

    # Project memberships via active teams
    # Count distinct projects for user's teams
    res_proj = await session.execute(
        select(func.count(func.distinct(ProjectTeam.project_id)))
        .select_from(ProjectTeam)
        .join(Team, Team.id == ProjectTeam.team_id)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .where(and_(TeamMember.user_id == current_user.id, ProjectTeam.is_active == True))
    )
    projects_count = int(res_proj.scalar() or 0)

    return {
        "completed": {
            "day": completed_day,
            "week": completed_week,
            "month": completed_month,
            "all_time": completed_all,
        },
        "overdue_in_period": overdue_count,
        "teams_count": teams_count,
        "projects_count": projects_count,
    }


