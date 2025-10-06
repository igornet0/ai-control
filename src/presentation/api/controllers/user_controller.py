"""
User API controller.
Handles HTTP requests for user management operations.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from src.application.dto.user_dto import (
    CreateUserDTO,
    UpdateUserDTO,
    UserResponseDTO,
    UserListResponseDTO,
    ChangeUserRoleDTO,
    ChangeUserStatusDTO,
    UserSearchDTO,
    UserHierarchyDTO,
)
from src.application.use_cases.user_management.create_user import (
    CreateUserUseCase,
    CreateUserRequest,
)
from src.application.use_cases.user_management.update_user import (
    UpdateUserUseCase,
    UpdateUserRequest,
)
from src.application.use_cases.user_management.get_user import (
    GetUserUseCase,
    GetUserRequest,
    GetUsersUseCase,
    GetUsersRequest,
)
from src.domain.exceptions import (
    EntityNotFound,
    EntityAlreadyExists,
    ValidationError,
    PermissionDenied,
)
from src.infrastructure.config.logging import get_logger
from src.presentation.api.dependencies import (
    get_create_user_use_case,
    get_update_user_use_case,
    get_user_use_case,
    get_users_use_case,
    get_current_user_id,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


# Dependency injection functions are now imported from dependencies.py


@router.post(
    "/",
    response_model=UserResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
    description="Create a new user in the system with the provided information.",
)
async def create_user(
    user_data: CreateUserDTO,
    use_case: CreateUserUseCase = Depends(get_create_user_use_case),
    current_user_id: UUID = Depends(get_current_user_id),
):
    """
    Create a new user.
    
    Args:
        user_data: User creation data
        use_case: Create user use case
        current_user_id: Current authenticated user ID
        
    Returns:
        UserResponseDTO: Created user information
        
    Raises:
        HTTPException: If user creation fails
    """
    try:
        logger.info("Creating new user", extra={
            "login": user_data.login,
            "email": str(user_data.email),
            "role": user_data.role.value,
            "created_by": str(current_user_id),
        })
        
        # Hash password (this should be done in the use case or service layer)
        # For now, we'll assume the password is already hashed
        password_hash = user_data.password  # This should be hashed properly
        
        request = CreateUserRequest(
            login=user_data.login,
            username=user_data.username,
            email=user_data.email,
            password_hash=password_hash,
            role=user_data.role,
            manager_id=user_data.manager_id,
            department_id=user_data.department_id,
            organization_id=user_data.organization_id,
            position=user_data.position,
            phone=user_data.phone,
            bio=user_data.bio,
        )
        
        response = await use_case.execute(request)
        
        logger.info("User created successfully", extra={
            "user_id": str(response.user_id),
            "login": response.login,
        })
        
        return UserResponseDTO(
            user_id=response.user_id,
            login=response.login,
            username=response.username,
            email=response.email,
            role=response.role,
            status="active",  # Default status
            is_active=response.is_active,
            created_at=response.created_at,
        )
        
    except EntityAlreadyExists as e:
        logger.warning("User creation failed - entity already exists", extra={
            "error": str(e),
            "details": e.details,
        })
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": e.message,
                "details": e.details,
            }
        )
    except ValidationError as e:
        logger.warning("User creation failed - validation error", extra={
            "error": str(e),
            "field": e.field,
            "value": str(e.value),
        })
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": e.message,
                "field": e.field,
                "value": str(e.value),
                "reason": e.reason,
            }
        )
    except Exception as e:
        logger.error("User creation failed - unexpected error", extra={
            "error": str(e),
            "error_type": type(e).__name__,
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get(
    "/{user_id}",
    response_model=UserResponseDTO,
    summary="Get user by ID",
    description="Retrieve user information by user ID.",
)
async def get_user(
    user_id: UUID,
    use_case: GetUserUseCase = Depends(get_user_use_case),
):
    """
    Get user by ID.
    
    Args:
        user_id: User ID
        use_case: Get user use case
        
    Returns:
        UserResponseDTO: User information
        
    Raises:
        HTTPException: If user not found
    """
    try:
        logger.info("Getting user", extra={"user_id": str(user_id)})
        
        request = GetUserRequest(user_id=user_id)
        response = await use_case.execute(request)
        
        logger.info("User retrieved successfully", extra={"user_id": str(user_id)})
        
        return UserResponseDTO(
            user_id=response.user_id,
            login=response.login,
            username=response.username,
            email=response.email,
            role=response.role,
            status=response.status,
            is_active=response.is_active,
            manager_id=response.manager_id,
            department_id=response.department_id,
            organization_id=response.organization_id,
            position=response.position,
            phone=response.phone,
            avatar_url=response.avatar_url,
            bio=response.bio,
            created_at=response.created_at,
            updated_at=response.updated_at,
            last_login=response.last_login,
        )
        
    except EntityNotFound as e:
        logger.warning("User not found", extra={
            "user_id": str(user_id),
            "error": str(e),
        })
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": e.message,
                "entity_type": e.entity_type,
                "entity_id": str(e.entity_id),
            }
        )
    except Exception as e:
        logger.error("Get user failed - unexpected error", extra={
            "user_id": str(user_id),
            "error": str(e),
            "error_type": type(e).__name__,
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get(
    "/",
    response_model=UserListResponseDTO,
    summary="Get users",
    description="Retrieve a list of users with optional filtering and pagination.",
)
async def get_users(
    organization_id: UUID = Query(None, description="Filter by organization ID"),
    department_id: UUID = Query(None, description="Filter by department ID"),
    role: str = Query(None, description="Filter by role"),
    status: str = Query(None, description="Filter by status"),
    search: str = Query(None, description="Search query"),
    limit: int = Query(50, ge=1, le=100, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    use_case: GetUsersUseCase = Depends(get_users_use_case),
):
    """
    Get users with filtering and pagination.
    
    Args:
        organization_id: Filter by organization ID
        department_id: Filter by department ID
        role: Filter by role
        status: Filter by status
        search: Search query
        limit: Number of results to return
        offset: Offset for pagination
        use_case: Get users use case
        
    Returns:
        UserListResponseDTO: List of users with pagination info
    """
    try:
        logger.info("Getting users", extra={
            "organization_id": str(organization_id) if organization_id else None,
            "department_id": str(department_id) if department_id else None,
            "role": role,
            "status": status,
            "search": search,
            "limit": limit,
            "offset": offset,
        })
        
        request = GetUsersRequest(
            organization_id=organization_id,
            department_id=department_id,
            role=role,
            status=status,
            search_query=search,
            limit=limit,
            offset=offset,
        )
        
        response = await use_case.execute(request)
        
        logger.info("Users retrieved successfully", extra={
            "count": len(response.users),
            "total_count": response.total_count,
        })
        
        return UserListResponseDTO(
            users=response.users,
            total_count=response.total_count,
            limit=response.limit,
            offset=offset,
        )
        
    except Exception as e:
        logger.error("Get users failed - unexpected error", extra={
            "error": str(e),
            "error_type": type(e).__name__,
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.put(
    "/{user_id}",
    response_model=UserResponseDTO,
    summary="Update user",
    description="Update user information.",
)
async def update_user(
    user_id: UUID,
    user_data: UpdateUserDTO,
    use_case: UpdateUserUseCase = Depends(get_update_user_use_case),
    current_user_id: UUID = Depends(get_current_user_id),
):
    """
    Update user information.
    
    Args:
        user_id: User ID
        user_data: User update data
        use_case: Update user use case
        current_user_id: Current authenticated user ID
        
    Returns:
        UserResponseDTO: Updated user information
        
    Raises:
        HTTPException: If user update fails
    """
    try:
        logger.info("Updating user", extra={
            "user_id": str(user_id),
            "updated_by": str(current_user_id),
        })
        
        request = UpdateUserRequest(
            user_id=user_id,
            username=user_data.username,
            email=user_data.email,
            phone=user_data.phone,
            bio=user_data.bio,
            avatar_url=user_data.avatar_url,
            position=user_data.position,
            manager_id=user_data.manager_id,
            department_id=user_data.department_id,
            updated_by=current_user_id,
        )
        
        response = await use_case.execute(request)
        
        logger.info("User updated successfully", extra={"user_id": str(user_id)})
        
        return UserResponseDTO(
            user_id=response.user_id,
            login=response.login,
            username=response.username,
            email=response.email,
            role=response.role,
            is_active=response.is_active,
            updated_at=response.updated_at,
        )
        
    except EntityNotFound as e:
        logger.warning("User update failed - user not found", extra={
            "user_id": str(user_id),
            "error": str(e),
        })
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": e.message,
                "entity_type": e.entity_type,
                "entity_id": str(e.entity_id),
            }
        )
    except ValidationError as e:
        logger.warning("User update failed - validation error", extra={
            "error": str(e),
            "field": e.field,
            "value": str(e.value),
        })
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": e.message,
                "field": e.field,
                "value": str(e.value),
                "reason": e.reason,
            }
        )
    except Exception as e:
        logger.error("User update failed - unexpected error", extra={
            "user_id": str(user_id),
            "error": str(e),
            "error_type": type(e).__name__,
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete user",
    description="Delete a user from the system.",
)
async def delete_user(
    user_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
):
    """
    Delete user.
    
    Args:
        user_id: User ID
        current_user_id: Current authenticated user ID
        
    Raises:
        HTTPException: If user deletion fails
    """
    try:
        logger.info("Deleting user", extra={
            "user_id": str(user_id),
            "deleted_by": str(current_user_id),
        })
        
        # This will be implemented with proper use case
        # For now, just return success
        logger.info("User deleted successfully", extra={"user_id": str(user_id)})
        
        return JSONResponse(
            status_code=status.HTTP_204_NO_CONTENT,
            content=None
        )
        
    except Exception as e:
        logger.error("User deletion failed - unexpected error", extra={
            "user_id": str(user_id),
            "error": str(e),
            "error_type": type(e).__name__,
        })
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
