from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class Role(SQLModel, table=True):
    __tablename__ = "roles"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=50, unique=True, index=True)
    guard: str = Field(default="admin", max_length=20)
    description: str | None = Field(default=None)
    is_system: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Permission(SQLModel, table=True):
    __tablename__ = "permissions"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, unique=True, index=True)
    module: str = Field(max_length=50, index=True)
    guard: str = Field(default="admin", max_length=20)
    description: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RolePermission(SQLModel, table=True):
    __tablename__ = "role_permissions"

    role_id: int = Field(foreign_key="roles.id", primary_key=True)
    permission_id: int = Field(foreign_key="permissions.id", primary_key=True)


class AdminUserRole(SQLModel, table=True):
    __tablename__ = "admin_user_roles"

    admin_user_id: int = Field(foreign_key="admin_users.id", primary_key=True)
    role_id: int = Field(foreign_key="roles.id", primary_key=True)
