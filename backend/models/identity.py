from datetime import datetime
from typing import Literal
import uuid

from pydantic import BaseModel, Field

from lib.dates import now_utc


class PatientRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_user_id: str | None = None
    patient_code: str
    phone_normalized: str
    name: str
    age: int = Field(ge=0, le=120)
    gender: str
    location: str
    address: str
    emergency_contact: str
    blood_group: str | None = None
    weight_kg: float | None = Field(default=None, ge=1, le=500)
    existing_conditions: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    medicines: list[str] = Field(default_factory=list)
    previous_history: list[str] = Field(default_factory=list)
    profile_complete: bool = False
    qr_token_hash: str | None = None
    qr_expires_at: datetime | None = None
    consent_code_hash: str | None = None
    consent_expires_at: datetime | None = None
    consent_used_at: datetime | None = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class PatientProfile(BaseModel):
    patient_code: str
    name: str
    age: int
    gender: str
    mobile: str
    location: str
    address: str
    emergency_contact: str
    blood_group: str | None = None
    weight_kg: float | None = None
    existing_conditions: list[str]
    allergies: list[str]
    medicines: list[str]
    previous_history: list[str]
    profile_complete: bool


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    age: int = Field(ge=0, le=120)
    gender: str = Field(min_length=1, max_length=40)
    mobile: str = Field(min_length=7, max_length=24)
    location: str = Field(min_length=2, max_length=120)
    address: str = Field(min_length=2, max_length=240)
    emergency_contact: str = Field(min_length=2, max_length=120)
    blood_group: str | None = Field(default=None, max_length=8)
    weight_kg: float | None = Field(default=None, ge=1, le=500)
    existing_conditions: list[str] = Field(default_factory=list, max_length=50)
    allergies: list[str] = Field(default_factory=list, max_length=50)
    medicines: list[str] = Field(default_factory=list, max_length=50)
    previous_history: list[str] = Field(default_factory=list, max_length=100)


class PatientIdentity(BaseModel):
    patient_code: str
    normalized_phone: str
    qr_payload: str
    qr_svg_data_url: str
    qr_expires_at: datetime


class ConsentCodeResponse(BaseModel):
    consent_code: str
    expires_at: datetime
    instruction: str = "Share this one-time code only with the provider you authorize."


class IdentityLookupRequest(BaseModel):
    method: Literal["patient_code", "phone", "qr"]
    value: str = Field(min_length=3, max_length=500)


class IdentityPreview(BaseModel):
    access_request_id: str
    patient_code: str
    name: str
    age: int
    gender: str
    masked_phone: str
    method: str
    expires_at: datetime
    authorization_required: bool = True


class AuthorizeAccessRequest(BaseModel):
    consent_code: str = Field(pattern=r"^\d{6}$")


class AuthorizedPatientAccess(BaseModel):
    access_request_id: str
    patient: PatientProfile
    authorization_granted: bool = True
    expires_at: datetime
    access_note: str
    documents: list[dict] = Field(default_factory=list)
    prior_referrals: list[dict] = Field(default_factory=list)


class BreakGlassRequest(BaseModel):
    method: Literal["patient_code", "phone", "qr"]
    value: str = Field(min_length=3, max_length=500)
    emergency_event_id: str
    reason: str = Field(min_length=10, max_length=500)


class AuditEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    actor_user_id: str
    actor_role: str
    patient_id: str | None = None
    action: str
    reason: str | None = None
    resource_id: str | None = None
    created_at: datetime = Field(default_factory=now_utc)