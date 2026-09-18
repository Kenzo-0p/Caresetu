from datetime import datetime
from typing import Literal
import uuid

from pydantic import BaseModel, Field

from lib.dates import now_utc
from models.identity import PatientProfile, ProfileUpdate


ReferralStatus = Literal[
    "DRAFT",
    "CONFIRMED",
    "SENT",
    "RECEIVED",
    "ACCEPTED",
    "ARRIVED",
    "COMPLETED",
    "REJECTED",
    "REDIRECTED",
    "CANCELLED",
]


class Event(BaseModel):
    label: str
    timestamp: datetime = Field(default_factory=now_utc)
    detail: str | None = None
    actor_user_id: str | None = None
    actor_role: str | None = None


class AssessmentSessionCreate(BaseModel):
    symptoms: str = Field(min_length=3, max_length=2000)


class AssessmentMessage(BaseModel):
    session_id: str
    answer: str = Field(min_length=1, max_length=500)


class AssessmentSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    symptoms: str
    answers: list[str] = Field(default_factory=list)
    question_index: int = 0
    status: Literal["active", "completed"] = "active"
    outcome: str | None = None
    guidance: str | None = None
    created_at: datetime = Field(default_factory=now_utc)


class AssessmentMessageResponse(BaseModel):
    session_id: str
    question: str | None = None
    question_index: int
    total_questions: int
    complete: bool
    outcome: str | None = None
    guidance: str | None = None
    urgency: Literal["ROUTINE", "URGENT", "EMERGENCY"] = "ROUTINE"
    review: str = "deterministic safety-reviewed pathway"


class DoctorAssessmentRequest(BaseModel):
    access_request_id: str
    symptoms: str = Field(min_length=3, max_length=2000)
    findings: str = Field(default="", max_length=2000)
    vitals: str = Field(default="", max_length=1000)


class DoctorAssessment(BaseModel):
    mode: Literal["deterministic_fallback"] = "deterministic_fallback"
    urgency: str = "ROUTINE"
    care_requirement: str = "Primary care review"
    summary: str
    suggested_capabilities: list[str]
    review: str = "AI/rule-assisted support only — clinician confirmation required"


class Facility(BaseModel):
    id: str
    name: str
    location: str
    distance: str
    capabilities: list[str]
    match_reason: str
    emergency_ready: bool = False


class FacilityMatchResponse(BaseModel):
    requirement: str
    facilities: list[Facility]
    note: str = "Mandatory capabilities first; location and fixed demo order are tie-breakers."


class ReferralCreate(BaseModel):
    access_request_id: str
    facility_id: str
    reason: str = Field(min_length=3, max_length=500)
    care_requirement: str = "Primary care review"
    urgency: str = "ROUTINE"
    symptoms: str = Field(default="", max_length=2000)
    findings: str = Field(default="", max_length=2000)
    vitals: str = Field(default="", max_length=1000)
    ai_assessment: str = Field(default="", max_length=2000)
    doctor_decision: str = Field(min_length=3, max_length=1000)
    idempotency_key: str = Field(min_length=8, max_length=100)


class ReferralPatientSnapshot(BaseModel):
    age: int
    gender: str
    blood_group: str | None = None
    existing_conditions: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    medicines: list[str] = Field(default_factory=list)


class Referral(BaseModel):
    id: str = Field(default_factory=lambda: f"REF-{uuid.uuid4().hex[:10].upper()}")
    idempotency_key: str
    patient_id: str
    patient_code: str
    patient_name: str
    patient_summary: ReferralPatientSnapshot
    access_request_id: str | None = None
    referring_user_id: str | None = None
    referring_provider_name: str = ""
    facility_id: str
    facility_name: str
    reason: str
    care_requirement: str
    urgency: str
    symptoms: str = ""
    findings: str = ""
    vitals: str = ""
    ai_assessment: str = ""
    doctor_decision: str
    status: ReferralStatus = "DRAFT"
    emergency: bool = False
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    events: list[Event] = Field(default_factory=list)
    outcome: str | None = None


class ReferralActionRequest(BaseModel):
    status: Literal["ACCEPTED", "REJECTED", "REDIRECTED", "ARRIVED", "COMPLETED", "CANCELLED"]
    outcome: str | None = Field(default=None, max_length=2000)
    reason: str | None = Field(default=None, max_length=1000)


class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    filename: str
    storage_name: str
    content_type: str
    size_bytes: int
    review_status: Literal["processing", "needs_verification", "unreadable", "verified", "rejected"] = "processing"
    extracted_fields: list[str] = Field(default_factory=list)
    original_available: bool = True
    extraction_mode: str = "deterministic_mock"
    review_actor_user_id: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime = Field(default_factory=now_utc)


class DocumentReviewRequest(BaseModel):
    access_request_id: str
    decision: Literal["verified", "rejected"]


class SOSCreate(BaseModel):
    note: str = Field(default="", max_length=500)
    idempotency_key: str = Field(min_length=8, max_length=100)


class EmergencyEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"SOS-{uuid.uuid4().hex[:10].upper()}")
    idempotency_key: str
    patient_id: str
    patient_code: str
    patient_name: str
    status: str = "AMBULANCE_INITIATED"
    dispatch_status: str = "SIMULATED_DISPATCH"
    note: str = ""
    selected_facility_id: str | None = None
    selected_facility_name: str | None = None
    referral_id: str | None = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    audit_note: str = "Emergency action and access events are audit logged."


class SOSResponse(BaseModel):
    event: EmergencyEvent
    facilities: list[Facility]
    message: str


class SOSFacilitySelect(BaseModel):
    sos_id: str
    facility_id: str


class SOSContextUpdate(BaseModel):
    note: str = Field(min_length=1, max_length=500)


class DashboardState(BaseModel):
    profile: PatientProfile | None = None
    facilities: list[Facility]
    referrals: list[Referral]
    emergencies: list[EmergencyEvent]
    documents: list[Document]


class HospitalQueue(BaseModel):
    emergencies: list[EmergencyEvent]
    referrals: list[Referral]