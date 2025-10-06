"""
Исключения для сервиса задач
"""


class TaskServiceError(Exception):
    """Базовое исключение для сервиса задач"""
    pass


class TaskNotFoundError(TaskServiceError):
    """Задача не найдена"""
    pass


class TaskAccessDeniedError(TaskServiceError):
    """Доступ к задаче запрещен"""
    pass


class TaskEditDeniedError(TaskServiceError):
    """Редактирование задачи запрещено"""
    pass


class TaskDeleteDeniedError(TaskServiceError):
    """Удаление задачи запрещено"""
    pass


class TaskValidationError(TaskServiceError):
    """Ошибка валидации задачи"""
    pass


class TaskDependencyError(TaskServiceError):
    """Ошибка зависимостей задачи"""
    pass
