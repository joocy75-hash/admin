from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class KycDocument(SQLModel, table=True):
    __tablename__ = "kyc_documents"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    document_type: str = Field(max_length=30)  # id_card, passport, driver_license, utility_bill
    document_number: str | None = Field(default=None, max_length=50)
    front_image_url: str | None = Field(default=None, max_length=500)
    back_image_url: str | None = Field(default=None, max_length=500)
    selfie_image_url: str | None = Field(default=None, max_length=500)
    status: str = Field(default="pending", max_length=20, index=True)  # pending, approved, rejected, expired
    rejection_reason: str | None = Field(default=None, max_length=500)
    reviewed_by: int | None = Field(default=None, foreign_key="admin_users.id")
    reviewed_at: datetime | None = Field(default=None)
    expires_at: datetime | None = Field(default=None)
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
