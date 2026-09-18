from pathlib import Path
from pathlib import Path
from typing import Annotated
import uuid

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from lib.db import db
from models.domain import (
    AssessmentMessage,
    AssessmentMessageResponse,
    AssessmentSession,
    AssessmentSessionCreate,
    DoctorAssessment,
    DoctorAssessmentRequest,
    DoctorLookupRequest,
    DoctorLookupResponse,
    Document,
    DemoState,
    EmergencyEvent,
    Facility,
    FacilityMatchResponse,
    HospitalQueue,
    PatientProfile,
    ProfileUpdate,
    Referral,
    ReferralStatusUpdate,
    ReferralCreate,
    SOSCreate,
    SOSContextUpdate,
    SOSFacilitySelect,
    SOSResponse,
    Event,
)

router = APIRouter()
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

QUESTIONS = [
    "When did this start?",
    "Is it getting better, worse, or unchanged?",
    "Are you having difficulty breathing or feeling faint?",
]

FACILITIES = [
    Facility(
        id="facility-a",
        name="Harborview Medical Centre",
        location="Indiranagar, Bengaluru",
        distance="4.8 km",
        capabilities=["Emergency", "Cardiology", "ECG", "Diagnostics"],
        match_reason="Emergency department and cardiology capability match this care requirement.",
        emergency_ready=True,
    ),
    Facility(
        id="facility-b",
        name="Greenline Community Hospital",
        location="Koramangala, Bengaluru",
        distance="7.2 km",
        capabilities=["Emergency", "ECG", "Diagnostics"],
        match_reason="Emergency intake and ECG diagnostics are available for initial review.",
        emergency_ready=True,
    ),
    Facility(
        id="facility-c",
        name="Northstar General Hospital",
        location="Hebbal, Bengaluru",
        distance="11.6 km",
        capabilities=["Primary Care", "Diagnostics", "Internal Medicine"],
        match_reason="A suitable routine-care option with internal medicine and diagnostics.",
        emergency_ready=False,
    ),
]


def default_profile() -> PatientProfile:
    return PatientProfile()


async def get_profile() -> PatientProfile:
    raw = await db.patient_profiles.find_one({"id": "demo-patient-001"})
    if raw:
        return PatientProfile(**raw)
    profile = default_profile()
    await db.patient_profiles.insert_one(profile.model_dump())
    return profile


def parse_model_list(raw_items: list[dict], model: type):
    return [model(**item) for item in raw_items]


@router.get("/")
async def root():
    return {"message": "TECHNEXA demo API ready", "mode": "deterministic_demo"}


@router.get("/demo/state", response_model=DemoState)
async def demo_state():
    profile = await get_profile()
    referrals_raw = await db.referrals.find().sort("created_at", -1).to_list(50)
    emergencies_raw = await db.emergency_events.find().sort("created_at", -1).to_list(50)
    documents_raw = await db.documents.find().sort("created_at", -1).to_list(50)
    return DemoState(
        profile=profile,
        facilities=FACILITIES,
        referrals=parse_model_list(referrals_raw, Referral),
        emergencies=parse_model_list(emergencies_raw, EmergencyEvent),
        documents=parse_model_list(documents_raw, Document),
    )


@router.put("/patient/profile", response_model=PatientProfile)
async def update_profile(input: ProfileUpdate):
    profile = await get_profile()
    updated = profile.model_copy(update={**input.model_dump(), "profile_complete": True})
    await db.patient_profiles.replace_one({"id": profile.id}, updated.model_dump(), upsert=True)
    return updated


@router.post("/assessment/session", response_model=AssessmentMessageResponse)
async def create_assessment(input: AssessmentSessionCreate):
    session = AssessmentSession(symptoms=input.symptoms)
    await db.assessments.insert_one(session.model_dump())
    return AssessmentMessageResponse(
        session_id=session.id,
        question=QUESTIONS[0],
        question_index=0,
        total_questions=len(QUESTIONS),
        complete=False,
    )


@router.post("/assessment/message", response_model=AssessmentMessageResponse)
async def assessment_message(input: AssessmentMessage):
    raw = await db.assessments.find_one({"id": input.session_id})
    if not raw:
        raise HTTPException(status_code=404, detail="Assessment session not found")
    session = AssessmentSession(**raw)
    answers = [*session.answers, input.answer]
    next_index = session.question_index + 1
    if next_index >= len(QUESTIONS):
        await db.assessments.update_one(
            {"id": session.id},
            {"$set": {"answers": answers, "question_index": next_index, "status": "completed", "outcome": "NORMAL", "guidance": "Based on your answers, please consult a doctor."}},
        )
        return AssessmentMessageResponse(
            session_id=session.id,
            question_index=next_index,
            total_questions=len(QUESTIONS),
            complete=True,
            outcome="NORMAL",
            guidance="Based on your answers, please consult a doctor.",
        )
    await db.assessments.update_one({"id": session.id}, {"$set": {"answers": answers, "question_index": next_index}})
    return AssessmentMessageResponse(
        session_id=session.id,
        question=QUESTIONS[next_index],
        question_index=next_index,
        total_questions=len(QUESTIONS),
        complete=False,
    )


@router.post("/doctor/patients/lookup", response_model=DoctorLookupResponse)
async def doctor_lookup(input: DoctorLookupRequest):
    if not input.authorization_granted:
        raise HTTPException(status_code=403, detail="Patient authorization is required for normal access")
    profile = await get_profile()
    if input.identifier.lower() not in {profile.secure_id.lower(), profile.mobile.lower(), profile.id.lower()}:
        raise HTTPException(status_code=404, detail="No demo patient matched that secure ID or phone")
    return DoctorLookupResponse(
        patient=profile,
        authorization_granted=True,
        access_note="Patient authorization confirmed. Access is recorded for this demo workspace.",
    )


@router.post("/doctor/assessment-assistance", response_model=DoctorAssessment)
async def doctor_assessment_assistance(input: DoctorAssessmentRequest):
    return DoctorAssessment(
        summary="Symptoms and current findings suggest a routine clinical review. Confirm or change this assessment before sending a referral.",
        suggested_capabilities=["Primary Care", "Internal Medicine", "Diagnostics"],
    )


@router.get("/facilities/match", response_model=FacilityMatchResponse)
async def facilities_match(requirement: Annotated[str, Query()] = "ROUTINE"):
    if requirement.upper() in {"EMERGENCY", "EMERGENCY_CARE"}:
        matches = [facility for facility in FACILITIES if facility.emergency_ready]
    else:
        matches = [FACILITIES[2], FACILITIES[0], FACILITIES[1]]
    return FacilityMatchResponse(requirement=requirement, facilities=matches[:3])


@router.post("/referrals", response_model=Referral)
async def create_referral(input: ReferralCreate):
    profile = await get_profile()
    facility = next((item for item in FACILITIES if item.id == input.facility_id), None)
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    referral = Referral(
        patient_id=input.patient_id,
        patient_name=profile.name,
        facility_id=facility.id,
        facility_name=facility.name,
        reason=input.reason,
        care_requirement=input.care_requirement,
        urgency=input.urgency,
        symptoms=input.symptoms,
        findings=input.findings,
        ai_assessment=input.ai_assessment,
        doctor_decision=input.doctor_decision,
        emergency=input.emergency,
        events=[
            Event(label="Created", detail="Referral confirmed by referring clinician"),
            Event(label="Sent", detail="Digital referral sent to receiving hospital"),
            Event(label="Received", detail="Referral is visible in the hospital queue"),
        ],
    )
    await db.referrals.insert_one(referral.model_dump())
    return referral


@router.post("/referrals/{referral_id}/status", response_model=Referral)
async def update_referral_status(referral_id: str, input: ReferralStatusUpdate):
    raw = await db.referrals.find_one({"id": referral_id})
    if not raw:
        raise HTTPException(status_code=404, detail="Referral not found")
    referral = Referral(**raw)
    allowed_transitions = {
        "Sent": {"Accepted", "Rejected", "Redirected"},
        "Accepted": {"Arrived"},
        "Arrived": {"Outcome Updated"},
    }
    if input.status not in allowed_transitions.get(referral.status, set()):
        raise HTTPException(status_code=409, detail=f"Cannot move referral from {referral.status} to {input.status}")
    event = Event(label=input.status, detail=input.detail or "Hospital operations update")
    update = {"status": input.status, "$push": {"events": event.model_dump()}}
    set_fields = {"status": input.status}
    if input.outcome:
        set_fields["outcome"] = input.outcome
    await db.referrals.update_one({"id": referral_id}, {"$set": set_fields, "$push": {"events": event.model_dump()}})
    referral.status = input.status
    referral.events.append(event)
    if input.outcome:
        referral.outcome = input.outcome
    return referral


@router.post("/sos", response_model=SOSResponse)
async def create_sos(input: SOSCreate):
    profile = await get_profile()
    event = EmergencyEvent(patient_id=profile.id, patient_name=profile.name, note=input.note)
    await db.emergency_events.insert_one(event.model_dump())
    return SOSResponse(
        event=event,
        facilities=[facility for facility in FACILITIES if facility.emergency_ready],
        message="Emergency action initiated. Simulated ambulance dispatch recorded immediately.",
    )


@router.post("/sos/{sos_id}/context", response_model=EmergencyEvent)
async def update_sos_context(sos_id: str, input: SOSContextUpdate):
    raw = await db.emergency_events.find_one({"id": sos_id})
    if not raw:
        raise HTTPException(status_code=404, detail="Emergency event not found")
    await db.emergency_events.update_one({"id": sos_id}, {"$set": {"note": input.note}})
    event = EmergencyEvent(**raw)
    event.note = input.note
    return event


@router.post("/sos/select-facility", response_model=SOSResponse)
async def select_sos_facility(input: SOSFacilitySelect):
    raw = await db.emergency_events.find_one({"id": input.sos_id})
    facility = next((item for item in FACILITIES if item.id == input.facility_id), None)
    if not raw or not facility:
        raise HTTPException(status_code=404, detail="Emergency event or facility not found")
    event = EmergencyEvent(**raw)
    referral = Referral(
        patient_id=event.patient_id,
        patient_name=event.patient_name,
        facility_id=facility.id,
        facility_name=facility.name,
        reason="Emergency SOS destination selected",
        care_requirement="Emergency evaluation",
        urgency="Emergency",
        doctor_decision="Emergency workflow destination selected by patient/guardian",
        status="Sent",
        emergency=True,
        events=[
            Event(label="Created", detail="Emergency referral created from SOS"),
            Event(label="Sent", detail="Emergency alert sent to receiving hospital"),
            Event(label="Received", detail="Emergency alert is visible in hospital queue"),
        ],
    )
    event.status = "Hospital Alerted"
    event.selected_facility_id = facility.id
    event.selected_facility_name = facility.name
    event.referral_id = referral.id
    await db.referrals.insert_one(referral.model_dump())
    await db.emergency_events.replace_one({"id": event.id}, event.model_dump())
    return SOSResponse(
        event=event,
        facilities=[facility for facility in FACILITIES if facility.emergency_ready],
        message="Hospital notified. The emergency referral is now visible in the receiving queue.",
    )


@router.get("/hospital/queue", response_model=HospitalQueue)
async def hospital_queue():
    emergencies = await db.emergency_events.find().sort("created_at", -1).to_list(50)
    referrals = await db.referrals.find().sort("created_at", -1).to_list(50)
    return HospitalQueue(
        emergencies=parse_model_list(emergencies, EmergencyEvent),
        referrals=parse_model_list(referrals, Referral),
    )


@router.post("/documents/upload", response_model=Document)
async def upload_document(file: UploadFile = File(...)):
    filename = Path(file.filename or "medical-report").name
    allowed = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=415, detail="Upload a PDF, JPG, PNG, or WEBP medical document")
    data = await file.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Document exceeds the 10 MB demo limit")
    document = Document(
        id=str(uuid.uuid4()),
        filename=filename,
        content_type=file.content_type,
        size_bytes=len(data),
        review_status="unreadable" if "unreadable" in filename.lower() else "needs_verification",
        extracted_fields=[] if "unreadable" in filename.lower() else ["Hypertension", "BP 150/90", "Medication: Amlodipine"],
    )
    (UPLOAD_DIR / f"{document.id}-{filename}").write_bytes(data)
    await db.documents.insert_one(document.model_dump())
    return document


@router.post("/documents/{document_id}/verify", response_model=Document)
async def verify_document(document_id: str):
    raw = await db.documents.find_one({"id": document_id})
    if not raw:
        raise HTTPException(status_code=404, detail="Document not found")
    document = Document(**raw)
    if document.review_status == "unreadable":
        raise HTTPException(status_code=400, detail="Unreadable documents cannot be verified")
    await db.documents.update_one({"id": document_id}, {"$set": {"review_status": "verified"}})
    document.review_status = "verified"
    return document