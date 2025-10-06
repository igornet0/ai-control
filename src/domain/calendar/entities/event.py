"""
Event domain entity.
Represents a calendar event in the system.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from uuid import UUID

from pydantic import Field, validator

from src.domain.base import AggregateRoot, DomainEvent
from src.domain.exceptions import BusinessRuleViolation, ValidationError


class EventType(str, Enum):
    """Event type enumeration."""
    
    MEETING = "meeting"
    TASK = "task"
    REMINDER = "reminder"
    HOLIDAY = "holiday"
    PERSONAL = "personal"


class EventStatus(str, Enum):
    """Event status enumeration."""
    
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    POSTPONED = "postponed"


class EventCreatedEvent(DomainEvent):
    """Event raised when an event is created."""
    
    def __init__(self, event_id: UUID, title: str, event_type: EventType, created_by: UUID):
        super().__init__(
            event_type="event_created",
            aggregate_id=str(event_id),
            aggregate_type="Event",
            data={
                "event_id": str(event_id),
                "title": title,
                "event_type": event_type.value,
                "created_by": str(created_by),
            }
        )


class Event(Event):
    """Event domain entity."""
    
    # Basic information
    title: str = Field(..., min_length=1, max_length=255, description="Event title")
    description: Optional[str] = Field(default=None, description="Event description")
    event_type: EventType = Field(default=EventType.MEETING, description="Event type")
    status: EventStatus = Field(default=EventStatus.SCHEDULED, description="Event status")
    
    # Time information
    start_time: datetime = Field(..., description="Event start time")
    end_time: datetime = Field(..., description="Event end time")
    is_all_day: bool = Field(default=False, description="All day event flag")
    
    # Location
    location: Optional[str] = Field(default=None, description="Event location")
    meeting_url: Optional[str] = Field(default=None, description="Meeting URL")
    
    # Participants
    organizer_id: UUID = Field(..., description="Event organizer ID")
    attendees: List[UUID] = Field(default_factory=list, description="Attendee IDs")
    
    # Recurrence
    is_recurring: bool = Field(default=False, description="Recurring event flag")
    recurrence_rule: Optional[str] = Field(default=None, description="Recurrence rule")
    parent_event_id: Optional[UUID] = Field(default=None, description="Parent event ID for recurring events")
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Event metadata")
    reminders: List[int] = Field(default_factory=list, description="Reminder minutes before event")
    
    @validator("title")
    def validate_title(cls, v):
        """Validate event title."""
        if not v.strip():
            raise ValidationError(
                field="title",
                value=v,
                reason="Event title cannot be empty or only whitespace"
            )
        return v.strip()
    
    @validator("end_time")
    def validate_end_time(cls, v, values):
        """Validate end time."""
        if "start_time" in values and v <= values["start_time"]:
            raise ValidationError(
                field="end_time",
                value=v,
                reason="End time must be after start time"
            )
        return v
    
    def validate_business_rules(self) -> None:
        """Validate business rules for the event."""
        # Check if end time is after start time
        if self.end_time <= self.start_time:
            raise BusinessRuleViolation(
                "End time must be after start time",
                {"start_time": self.start_time.isoformat(), "end_time": self.end_time.isoformat()}
            )
        
        # Check if all day event has proper time range
        if self.is_all_day:
            start_date = self.start_time.date()
            end_date = self.end_time.date()
            if end_date < start_date:
                raise BusinessRuleViolation(
                    "All day event end date cannot be before start date",
                    {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()}
                )
        
        # Check if recurring event has recurrence rule
        if self.is_recurring and not self.recurrence_rule:
            raise BusinessRuleViolation(
                "Recurring event must have recurrence rule",
                {"is_recurring": self.is_recurring, "recurrence_rule": self.recurrence_rule}
            )
    
    def can_be_edited_by(self, user_id: UUID) -> bool:
        """Check if event can be edited by user."""
        # Organizer can always edit
        if user_id == self.organizer_id:
            return True
        
        # Attendees can edit if they have permission
        if user_id in self.attendees:
            return True
        
        return False
    
    def can_be_deleted_by(self, user_id: UUID) -> bool:
        """Check if event can be deleted by user."""
        # Only organizer can delete
        return user_id == self.organizer_id
    
    def can_be_cancelled_by(self, user_id: UUID) -> bool:
        """Check if event can be cancelled by user."""
        # Organizer can always cancel
        if user_id == self.organizer_id:
            return True
        
        # Attendees can cancel if they have permission
        if user_id in self.attendees:
            return True
        
        return False
    
    def add_attendee(self, user_id: UUID) -> None:
        """Add attendee to event."""
        if user_id not in self.attendees:
            self.attendees.append(user_id)
            self.mark_as_updated()
    
    def remove_attendee(self, user_id: UUID) -> None:
        """Remove attendee from event."""
        if user_id in self.attendees:
            self.attendees.remove(user_id)
            self.mark_as_updated()
    
    def is_attendee(self, user_id: UUID) -> bool:
        """Check if user is attendee."""
        return user_id in self.attendees
    
    def is_organizer(self, user_id: UUID) -> bool:
        """Check if user is organizer."""
        return user_id == self.organizer_id
    
    def is_participant(self, user_id: UUID) -> bool:
        """Check if user is participant (organizer or attendee)."""
        return self.is_organizer(user_id) or self.is_attendee(user_id)
    
    def get_duration(self) -> timedelta:
        """Get event duration."""
        return self.end_time - self.start_time
    
    def get_duration_minutes(self) -> int:
        """Get event duration in minutes."""
        return int(self.get_duration().total_seconds() / 60)
    
    def is_past(self) -> bool:
        """Check if event is in the past."""
        return self.end_time < datetime.utcnow()
    
    def is_future(self) -> bool:
        """Check if event is in the future."""
        return self.start_time > datetime.utcnow()
    
    def is_current(self) -> bool:
        """Check if event is currently happening."""
        now = datetime.utcnow()
        return self.start_time <= now <= self.end_time
    
    def is_today(self) -> bool:
        """Check if event is today."""
        today = datetime.utcnow().date()
        return self.start_time.date() == today or self.end_time.date() == today
    
    def is_this_week(self) -> bool:
        """Check if event is this week."""
        now = datetime.utcnow()
        week_start = now - timedelta(days=now.weekday())
        week_end = week_start + timedelta(days=6)
        
        return week_start.date() <= self.start_time.date() <= week_end.date()
    
    def is_this_month(self) -> bool:
        """Check if event is this month."""
        now = datetime.utcnow()
        return (self.start_time.year == now.year and 
                self.start_time.month == now.month)
    
    def has_conflict_with(self, other_event: "Event") -> bool:
        """Check if this event conflicts with another event."""
        # Check if events overlap
        return (self.start_time < other_event.end_time and 
                self.end_time > other_event.start_time)
    
    def get_conflict_attendees(self, other_event: "Event") -> List[UUID]:
        """Get attendees who have conflicts with another event."""
        if not self.has_conflict_with(other_event):
            return []
        
        return [attendee for attendee in self.attendees 
                if attendee in other_event.attendees]
    
    def add_reminder(self, minutes_before: int) -> None:
        """Add reminder to event."""
        if minutes_before not in self.reminders:
            self.reminders.append(minutes_before)
            self.reminders.sort()
            self.mark_as_updated()
    
    def remove_reminder(self, minutes_before: int) -> None:
        """Remove reminder from event."""
        if minutes_before in self.reminders:
            self.reminders.remove(minutes_before)
            self.mark_as_updated()
    
    def get_reminder_times(self) -> List[datetime]:
        """Get reminder times for the event."""
        reminder_times = []
        for minutes in self.reminders:
            reminder_time = self.start_time - timedelta(minutes=minutes)
            if reminder_time > datetime.utcnow():
                reminder_times.append(reminder_time)
        
        return sorted(reminder_times)
    
    def is_meeting(self) -> bool:
        """Check if event is a meeting."""
        return self.event_type == EventType.MEETING
    
    def is_task(self) -> bool:
        """Check if event is a task."""
        return self.event_type == EventType.TASK
    
    def is_reminder(self) -> bool:
        """Check if event is a reminder."""
        return self.event_type == EventType.REMINDER
    
    def is_holiday(self) -> bool:
        """Check if event is a holiday."""
        return self.event_type == EventType.HOLIDAY
    
    def is_personal(self) -> bool:
        """Check if event is personal."""
        return self.event_type == EventType.PERSONAL
    
    def is_scheduled(self) -> bool:
        """Check if event is scheduled."""
        return self.status == EventStatus.SCHEDULED
    
    def is_in_progress(self) -> bool:
        """Check if event is in progress."""
        return self.status == EventStatus.IN_PROGRESS
    
    def is_completed(self) -> bool:
        """Check if event is completed."""
        return self.status == EventStatus.COMPLETED
    
    def is_cancelled(self) -> bool:
        """Check if event is cancelled."""
        return self.status == EventStatus.CANCELLED
    
    def is_postponed(self) -> bool:
        """Check if event is postponed."""
        return self.status == EventStatus.POSTPONED
    
    @classmethod
    def create(
        cls,
        title: str,
        start_time: datetime,
        end_time: datetime,
        organizer_id: UUID,
        description: Optional[str] = None,
        event_type: EventType = EventType.MEETING,
        location: Optional[str] = None,
        meeting_url: Optional[str] = None,
        attendees: Optional[List[UUID]] = None,
        is_all_day: bool = False,
        is_recurring: bool = False,
        recurrence_rule: Optional[str] = None,
        reminders: Optional[List[int]] = None,
    ) -> "Event":
        """Create a new event."""
        event = cls(
            title=title,
            description=description,
            event_type=event_type,
            start_time=start_time,
            end_time=end_time,
            organizer_id=organizer_id,
            location=location,
            meeting_url=meeting_url,
            attendees=attendees or [],
            is_all_day=is_all_day,
            is_recurring=is_recurring,
            recurrence_rule=recurrence_rule,
            reminders=reminders or [],
        )
        
        # Validate business rules
        event.validate_business_rules()
        
        # Add domain event
        event.add_domain_event(EventCreatedEvent(event.id, title, event_type, organizer_id))
        
        return event
