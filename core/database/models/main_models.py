# модели для БД
from typing import Literal, List
from sqlalchemy import DateTime, ForeignKey, Float, String, BigInteger, func, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database.base import Base

class User(Base):

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    login: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    role: Mapped[Literal["admin","CEO", "manager", "employee"]] = mapped_column(String(50), nullable=False, default="employee")

    dashboards: Mapped[List["Dashboard"]] = relationship("Dashboard", back_populates="user")
    users_groups: Mapped[List["UserGroup"]] = relationship("UserGroup", back_populates="users")
