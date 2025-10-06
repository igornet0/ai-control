"""
Widget repository interface.
Defines the contract for widget data access operations.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from uuid import UUID

from src.domain.dashboard.entities.widget import Widget


class WidgetRepository(ABC):
    """Abstract widget repository interface."""
    
    @abstractmethod
    async def create(self, widget: Widget) -> Widget:
        """Create a new widget."""
        pass
    
    @abstractmethod
    async def get_by_id(self, widget_id: UUID) -> Optional[Widget]:
        """Get widget by ID."""
        pass
    
    @abstractmethod
    async def update(self, widget: Widget) -> Widget:
        """Update an existing widget."""
        pass
    
    @abstractmethod
    async def delete(self, widget_id: UUID) -> bool:
        """Delete a widget."""
        pass
    
    @abstractmethod
    async def get_by_type(self, widget_type: str, limit: int = 100, offset: int = 0) -> List[Widget]:
        """Get widgets by type."""
        pass
    
    @abstractmethod
    async def get_by_category(self, category: str, limit: int = 100, offset: int = 0) -> List[Widget]:
        """Get widgets by category."""
        pass
    
    @abstractmethod
    async def get_active_widgets(self, limit: int = 100, offset: int = 0) -> List[Widget]:
        """Get active widgets."""
        pass
    
    @abstractmethod
    async def get_system_widgets(self, limit: int = 100, offset: int = 0) -> List[Widget]:
        """Get system widgets."""
        pass
    
    @abstractmethod
    async def get_custom_widgets(self, limit: int = 100, offset: int = 0) -> List[Widget]:
        """Get custom widgets."""
        pass
    
    @abstractmethod
    async def search_widgets(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Widget]:
        """Search widgets by query and filters."""
        pass
    
    @abstractmethod
    async def get_widget_statistics(self) -> Dict[str, Any]:
        """Get widget statistics."""
        pass
    
    @abstractmethod
    async def count_widgets(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count widgets matching filters."""
        pass
    
    @abstractmethod
    async def exists(self, widget_id: UUID) -> bool:
        """Check if widget exists."""
        pass
    
    @abstractmethod
    async def get_widgets_by_name(self, name: str, limit: int = 100, offset: int = 0) -> List[Widget]:
        """Get widgets by name."""
        pass
    
    @abstractmethod
    async def get_widgets_by_icon(self, icon: str, limit: int = 100, offset: int = 0) -> List[Widget]:
        """Get widgets by icon."""
        pass
