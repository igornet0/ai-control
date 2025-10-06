"""
Search query domain entity.
Represents a search query in the system.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import AggregateRoot, DomainEvent
from src.domain.exceptions import BusinessRuleViolation, ValidationError


class SearchType(str, Enum):
    """Search type enumeration."""
    
    GLOBAL = "global"
    TASKS = "tasks"
    DOCUMENTS = "documents"
    MESSAGES = "messages"
    EVENTS = "events"
    USERS = "users"
    KPIS = "kpis"
    DASHBOARDS = "dashboards"


class SearchScope(str, Enum):
    """Search scope enumeration."""
    
    ALL = "all"
    MY = "my"
    TEAM = "team"
    DEPARTMENT = "department"
    ORGANIZATION = "organization"
    PUBLIC = "public"


class SearchQueryCreatedEvent(DomainEvent):
    """Event raised when a search query is created."""
    
    def __init__(self, search_query_id: UUID, query: str, search_type: SearchType, user_id: UUID):
        super().__init__(
            event_type="search_query_created",
            aggregate_id=str(search_query_id),
            aggregate_type="SearchQuery",
            data={
                "search_query_id": str(search_query_id),
                "query": query,
                "search_type": search_type.value,
                "user_id": str(user_id),
            }
        )


class SearchQuery(SearchQuery):
    """Search query domain entity."""
    
    # Basic information
    query: str = Field(..., min_length=1, description="Search query")
    search_type: SearchType = Field(default=SearchType.GLOBAL, description="Search type")
    scope: SearchScope = Field(default=SearchScope.ALL, description="Search scope")
    
    # User context
    user_id: UUID = Field(..., description="User who performed the search")
    
    # Filters
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")
    sort_by: Optional[str] = Field(default=None, description="Sort field")
    sort_order: str = Field(default="desc", description="Sort order")
    
    # Pagination
    limit: int = Field(default=20, ge=1, le=1000, description="Results limit")
    offset: int = Field(default=0, ge=0, description="Results offset")
    
    # Results
    total_results: int = Field(default=0, ge=0, description="Total number of results")
    execution_time_ms: Optional[int] = Field(default=None, ge=0, description="Execution time in milliseconds")
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Search metadata")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    
    @validator("query")
    def validate_query(cls, v):
        """Validate search query."""
        if not v.strip():
            raise ValidationError(
                field="query",
                value=v,
                reason="Search query cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("sort_order")
    def validate_sort_order(cls, v):
        """Validate sort order."""
        valid_orders = ["asc", "desc"]
        if v not in valid_orders:
            raise ValidationError(
                field="sort_order",
                value=v,
                reason=f"Sort order must be one of: {', '.join(valid_orders)}"
            )
        return v
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the search query."""
        # Check if query is not too long
        if len(self.query) > 1000:
            raise BusinessRuleViolation(
                "Search query is too long",
                {"query_length": len(self.query), "max_length": 1000}
            )
        
        # Check if limit is reasonable
        if self.limit > 1000:
            raise BusinessRuleViolation(
                "Search limit is too high",
                {"limit": self.limit, "max_limit": 1000}
            )
    
    def can_be_performed_by(self, user_id: UUID) -> bool:
        """Check if search can be performed by user."""
        # User can search their own queries
        if user_id == self.user_id:
            return True
        
        # Add more business logic for permissions
        return True
    
    def is_global_search(self) -> bool:
        """Check if search is global."""
        return self.search_type == SearchType.GLOBAL
    
    def is_task_search(self) -> bool:
        """Check if search is for tasks."""
        return self.search_type == SearchType.TASKS
    
    def is_document_search(self) -> bool:
        """Check if search is for documents."""
        return self.search_type == SearchType.DOCUMENTS
    
    def is_message_search(self) -> bool:
        """Check if search is for messages."""
        return self.search_type == SearchType.MESSAGES
    
    def is_event_search(self) -> bool:
        """Check if search is for events."""
        return self.search_type == SearchType.EVENTS
    
    def is_user_search(self) -> bool:
        """Check if search is for users."""
        return self.search_type == SearchType.USERS
    
    def is_kpi_search(self) -> bool:
        """Check if search is for KPIs."""
        return self.search_type == SearchType.KPIS
    
    def is_dashboard_search(self) -> bool:
        """Check if search is for dashboards."""
        return self.search_type == SearchType.DASHBOARDS
    
    def is_my_scope(self) -> bool:
        """Check if search scope is my."""
        return self.scope == SearchScope.MY
    
    def is_team_scope(self) -> bool:
        """Check if search scope is team."""
        return self.scope == SearchScope.TEAM
    
    def is_department_scope(self) -> bool:
        """Check if search scope is department."""
        return self.scope == SearchScope.DEPARTMENT
    
    def is_organization_scope(self) -> bool:
        """Check if search scope is organization."""
        return self.scope == SearchScope.ORGANIZATION
    
    def is_public_scope(self) -> bool:
        """Check if search scope is public."""
        return self.scope == SearchScope.PUBLIC
    
    def is_all_scope(self) -> bool:
        """Check if search scope is all."""
        return self.scope == SearchScope.ALL
    
    def has_filters(self) -> bool:
        """Check if search has filters."""
        return len(self.filters) > 0
    
    def has_sorting(self) -> bool:
        """Check if search has sorting."""
        return self.sort_by is not None
    
    def is_ascending(self) -> bool:
        """Check if sort order is ascending."""
        return self.sort_order == "asc"
    
    def is_descending(self) -> bool:
        """Check if sort order is descending."""
        return self.sort_order == "desc"
    
    def get_filter(self, key: str, default: Any = None) -> Any:
        """Get filter value by key."""
        return self.filters.get(key, default)
    
    def set_filter(self, key: str, value: Any) -> None:
        """Set filter value by key."""
        self.filters[key] = value
        self.mark_as_updated()
    
    def remove_filter(self, key: str) -> None:
        """Remove filter by key."""
        if key in self.filters:
            del self.filters[key]
            self.mark_as_updated()
    
    def clear_filters(self) -> None:
        """Clear all filters."""
        self.filters.clear()
        self.mark_as_updated()
    
    def get_metadata(self, key: str, default: Any = None) -> Any:
        """Get metadata value by key."""
        return self.metadata.get(key, default)
    
    def set_metadata(self, key: str, value: Any) -> None:
        """Set metadata value by key."""
        self.metadata[key] = value
        self.mark_as_updated()
    
    def remove_metadata(self, key: str) -> None:
        """Remove metadata value by key."""
        if key in self.metadata:
            del self.metadata[key]
            self.mark_as_updated()
    
    def set_results(self, total_results: int, execution_time_ms: int) -> None:
        """Set search results."""
        self.total_results = total_results
        self.execution_time_ms = execution_time_ms
        self.mark_as_updated()
    
    def get_execution_time_seconds(self) -> Optional[float]:
        """Get execution time in seconds."""
        if self.execution_time_ms is None:
            return None
        
        return self.execution_time_ms / 1000.0
    
    def get_query_words(self) -> List[str]:
        """Get query words."""
        return [word.strip() for word in self.query.split() if word.strip()]
    
    def get_query_length(self) -> int:
        """Get query length."""
        return len(self.query)
    
    def is_empty_query(self) -> bool:
        """Check if query is empty."""
        return not self.query.strip()
    
    def is_short_query(self) -> bool:
        """Check if query is short (less than 3 characters)."""
        return len(self.query.strip()) < 3
    
    def is_long_query(self) -> bool:
        """Check if query is long (more than 100 characters)."""
        return len(self.query.strip()) > 100
    
    def get_pagination_info(self) -> Dict[str, Any]:
        """Get pagination information."""
        return {
            "limit": self.limit,
            "offset": self.offset,
            "total_results": self.total_results,
            "has_more": self.offset + self.limit < self.total_results,
            "current_page": (self.offset // self.limit) + 1,
            "total_pages": (self.total_results + self.limit - 1) // self.limit,
        }
    
    def get_search_summary(self) -> Dict[str, Any]:
        """Get search summary."""
        return {
            "query": self.query,
            "search_type": self.search_type.value,
            "scope": self.scope.value,
            "total_results": self.total_results,
            "execution_time_ms": self.execution_time_ms,
            "has_filters": self.has_filters(),
            "has_sorting": self.has_sorting(),
            "filters_count": len(self.filters),
            "query_length": self.get_query_length(),
            "query_words_count": len(self.get_query_words()),
        }
    
    @classmethod
    def create(
        cls,
        query: str,
        user_id: UUID,
        search_type: SearchType = SearchType.GLOBAL,
        scope: SearchScope = SearchScope.ALL,
        filters: Optional[Dict[str, Any]] = None,
        sort_by: Optional[str] = None,
        sort_order: str = "desc",
        limit: int = 20,
        offset: int = 0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "SearchQuery":
        """Create a new search query."""
        search_query = cls(
            query=query,
            user_id=user_id,
            search_type=search_type,
            scope=scope,
            filters=filters or {},
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset,
            metadata=metadata or {},
        )
        
        # Validate business rules
        search_query.validate_business_rules()
        
        # Add domain event
        search_query.add_domain_event(SearchQueryCreatedEvent(
            search_query.id, query, search_type, user_id
        ))
        
        return search_query
