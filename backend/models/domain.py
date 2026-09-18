from datetime import datetime, timezone
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Event(BaseModel):
    label: str
    timestamp: datetime = Field(default_factory=utc_now)
    detail: str | None = None


class PatientProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = "demo-patient-001"
    secure_id: str = "CARE-PT-001"
    name: str = "Maya Sharma"
    age: int = 29
    gender: str = "Female"
    mobile: str = "+91 98765 43210"
    location: str = "Bengaluru, Karnataka"
    address: str = "14 Lake View Road, Bengaluru"
    emergency_contact: str = "Arjun Sharma · +91 98765 40001"
    blood_group: str = "O+"
    existing_conditions: list[str] = Field(default_factory=lambda: ["Mild asthma"])
    allergies: list[str] = Field(default_factory=lambda: ["Penicillin"])
    medicines: list[str] = Field(default_factory=lambda: ["Salbutamol inhaler · as needed"])
    previous_history: list[str] = Field(default_factory=lambda: ["Asthma review · Jan 2026"])
    profile_complete: bool = True


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    age: int = Field(ge=0, le=120)
    mobile: str = Field(min_length=5, max_length=30)
    location: str = Field(min_length=2, max_length=120)
    emergency_contact: str = Field(min_length=2, max_length=120)
    existing_conditions: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    medicines: list[str] = Field(default_factory=list)
    previous_history: list[str] = Field(default_factory=list)


class AssessmentSessionCreate(BaseModel):
    symptoms: str = Field(min_length=3, max_length=2000)


class AssessmentMessage(BaseModel):
    session_id: str
    answer: str = Field(min_length=1, max_length=500)


class AssessmentSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str = "demo-patient-001"
    symptoms: str
    answers: list[str] = Field(default_factory=list)
    question_index: int = 0
    status: Literal["active", "completed"] = "active"
    outcome: str | None = None
    guidance: str | None = None
    created_at: datetime = Field(default_factory=utc_now)


class AssessmentMessageResponse(BaseModel):
    session_id: str
    question: str | None = None
    question_index: int
    total_questions: int
    complete: bool
    outcome: str | None = None
    guidance: str | None = None
    review: str = "deterministic demo pathway"


class DoctorLookupRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=120)
    authorization_granted: bool = False


class DoctorLookupResponse(BaseModel):
    patient: PatientProfile
    authorization_granted: bool
    access_note: str


class DoctorAssessmentRequest(BaseModel):
    symptoms: str = Field(min_length=3, max_length=2000)
    findings: str = Field(default="", max_length=2000)


class DoctorAssessment(BaseModel):
    mode: Literal["deterministic_demo"] = "deterministic_demo"
    urgency: str = "Routine"
    care_requirement: str = "Primary care review"
    summary: str
    suggested_capabilities: list[str]
    review: str = "AI-assisted support only — clinician confirmation required"


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
    note: str = "Capability match first; fixed demo order used as tie-breaker."


class ReferralCreate(BaseModel):
    patient_id: str = "demo-patient-001"
    facility_id: str
    reason: str = Field(min_length=3, max_length=500)
    care_requirement: str = "Primary care review"
    urgency: str = "Routine"
    symptoms: str = ""
    findings: str = ""
    ai_assessment: str = ""
    doctor_decision: str = Field(min_length=3, max_length=1000)
    emergency: bool = False


class Referral(BaseModel):
    id: str = Field(default_factory=lambda: f"REF-{uuid.uuid4().hex[:8].upper()}")
    patient_id: str
    patient_name: str = "Maya Sharma"
    facility_id: str
    facility_name: str
    reason: str
    care_requirement: str
    urgency: str
    symptoms: str = ""
    findings: str = ""
    ai_assessment: str = ""
    doctor_decision: str
    status: str = "Sent"
    emergency: bool = False
    created_at: datetime = Field(default_factory=utc_now)
    events: list[Event] = Field(default_factory=list)
    outcome: str | None = None


class ReferralStatusUpdate(BaseModel):
    status: Literal["Accepted", "Rejected", "Redirected", "Arrived", "Outcome Updated"]
    outcome: str | None = None
    detail: str | None = None


class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str = "demo-patient-001"
    filename: str
    content_type: str
    size_bytes: int
    review_status: Literal["processing", "needs_verification", "unreadable", "verified"] = "processing"
    extracted_fields: list[str] = Field(default_factory=list)
    original_available: bool = True
    created_at: datetime = Field(default_factory=utc_now)


class SOSCreate(BaseModel):
    patient_id: str = "demo-patient-001"
    note: str = Field(default="", max_length=500)


class EmergencyEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"SOS-{uuid.uuid4().hex[:8].upper()}")
    patient_id: str = "demo-patient-001"
    patient_name: str = "Maya Sharma"
    status: str = "Ambulance Initiated"
    dispatch_status: str = "SIMULATED_DISPATCH"
    note: str = ""
    selected_facility_id: str | None = None
    selected_facility_name: str | None = None
    referral_id: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    audit_note: str = "Emergency break-glass access recorded for demo review."


class SOSResponse(BaseModel):
    event: EmergencyEvent
    facilities: list[Facility]
    message: str


class SOSFacilitySelect(BaseModel):
    sos_id: str
    facility_id: str


class SOSContextUpdate(BaseModel):
    note: str = Field(min_length=1, max_length=500)


class DemoState(BaseModel):
    profile: PatientProfile
    facilities: list[Facility]
    referrals: list[Referral]
    emergencies: list[EmergencyEvent]
    documents: list[Document]


class HospitalQueue(BaseModel):
    emergencies: list[EmergencyEvent]
    referrals: list[Referral]