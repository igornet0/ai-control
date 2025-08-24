from .auth.router import router as auth_router
from .calendar.router import router as calendar_router
from .chat.router import router as chat_router
from .code_execution import router as code_execution_router
from .dashboards.router import router as dashboards_router
from .data_processing.router import router as data_processing_router
from .documents.router import router as documents_router
from .email.router import router as email_router
from .kpi.router import router as kpi_router
from .notification.router import router as notification_router
from .personal_dashboard.router import router as personal_dashboard_router
from .reports.router import router as reports_router
from .search.router import router as search_router
from .tasks.router import router as tasks_router
from .teams.router import router as teams_router
from .video_call.router import router as video_call_router
from .websocket import router as websocket_router
from .widgets.router import router as widgets_router
from .projects.router import router as projects_router

routers = [
    auth_router,
    calendar_router,
    chat_router,
    code_execution_router,
    dashboards_router,
    data_processing_router,
    documents_router,
    email_router,
    kpi_router,
    notification_router,
    personal_dashboard_router,
    reports_router,
    search_router,
    tasks_router,
    teams_router,
    video_call_router,
    websocket_router,
    widgets_router,
    projects_router,
]
