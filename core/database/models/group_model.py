from typing import Literal, List
from sqlalchemy import DateTime, ForeignKey, Float, String, BigInteger, func, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database.base import Base

class GroupUser(Base):
    """Модель для хранения информации о групповах."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=True)
    
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # users: Mapped[List["User"]] = relationship("User", back_populates="users_groups")
    # users: Mapped[List["User"]] = relationship("User", back_populates="users_groups")

class UserGroup(Base):
    """Модель для хранения информации о пользователях в группах."""
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    group_id: Mapped[int] = mapped_column(ForeignKey("group_users.id"), nullable=False)
    
    # user: Mapped["User"] = relationship("User", back_populates="user_groups")
    # group: Mapped["GroupUser"] = relationship("GroupUser", back_populates="users")
    users: Mapped[List["User"]] = relationship("User", back_populates="users_groups")