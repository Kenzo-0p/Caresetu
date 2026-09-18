from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


Role = Literal["patient", "doctor", "health_worker", "hospital_doctor", "hospital_admin"]


class UserRecord(BaseModel):
    id: str
    email: EmailStr
    password_hash: str
    display_name: str
    role: Role
    patient_id: str | None = None
    facility_id: str | None = None
    active: bool = True
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class SessionUser(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    role: Role
    patient_code: str | None = None
    facility_id: str | None = None


class SessionRecord(BaseModel):
    token_hash: str
    user_id: str
    created_at: datetime
    expires_at: datetime
    last_seen_at: datetime