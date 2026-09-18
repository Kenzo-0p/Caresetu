from pathlib import Path
from typing import Annotated
import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from lib.db import db
from lib.dates import now_utc
from models.auth import UserRecord
from models.domain import (
    AssessmentMessage,
    AssessmentMessageResponse,
    AssessmentSession,
    AssessmentSessionCreate,
    DashboardState,
    DoctorAssessment,
    DoctorAssessmentRequest,
    Document,
    DocumentReviewRequest,
    EmergencyEvent,
    Event,
    Facility,
    FacilityMatchResponse,
    HospitalQueue,
    ProfileUpdate,
    Referral,
    ReferralActionRequest,
    ReferralCreate,
    ReferralPatientSnapshot,
    SOSCreate,
    SOSContextUpdate,
    SOSFacilitySelect,
    SOSResponse,
)
from models.identity import PatientRecord
from models.identity import PatientProfile
from services.identity import normalize_phone, public_profile, record_audit, require_authorized_patient
from services.security import get_current_user, require_roles
from services.seed import reset_demo_data


router = APIRouter(tags=["clinical"])
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
provider_roles = require_roles("doctor", "health_worker")
hospital_roles = require_roles("hospital_doctor", "hospital_admin")

QUESTIONS = [
    "When did this start?",
    "Is it getting better, worse, or unchanged?",
    "Are you having difficulty breathing or feeling faint?",
]

FACILITIES = [
    Facility(id="facility-a", name="Harborview Medical Centre", location="Indiranagar, Bengaluru", distance="4.8 km", capabilities=["Emergency", "Cardiology", "ECG", "Diagnostics", "Imaging"], match_reason="Emergency, cardiology, ECG, diagnostics and imaging match the care requirement.", emergency_ready=True),
    Facility(id="facility-b", name="Greenline Community Hospital", location="Koramangala, Bengaluru", distance="7.2 km", capabilities=["Emergency", "ECG", "Diagnostics", "Imaging"], match_reason="Emergency intake, ECG, diagnostics and imaging support initial review.", emergency_ready=True),
    Facility(id="facility-c", name="Northstar General Hospital", location="Hebbal, Bengaluru", distance="11.6 km", capabilities=["Primary Care", "Diagnostics", "Internal Medicine"], match_reason="Primary care, internal medicine and diagnostics match routine review.", emergency_ready=False),
]


async def patient_for_user(user: UserRecord) -> PatientRecord:
    if not user.patient_id:
        raise HTTPException(status_code=403, detail="No patient record is linked to this account")
    raw = await db.patient_profiles.find_one({"id": user.patient_id})
    if not raw:
        raise HTTPException(status_code=404, detail="Patient profile unavailable")
    return PatientRecord(**raw)


def parse_list(raw_items: list[dict], model: type):
    return [model(**item) for item in raw_items]


def facility_by_id(facility_id: str) -> Facility:
    facility = next((item for item in FACILITIES if item.id == facility_id), None)
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    return facility


@router.get("/")
async def root():
    return {"message": "CareSetu MVP API ready", "mode": "authenticated_deterministic_mvp"}


@router.get("/dashboard", response_model=DashboardState)
async def dashboard(user: UserRecord = Depends(get_current_user)):
    profile = None
    document_filter: dict = {"id": "__none__"}
    referral_filter: dict = {"id": "__none__"}
    emergency_filter: dict = {"id": "__none__"}
    if user.role == "patient":
        patient = await patient_for_user(user)
        profile = public_profile(patient)
        document_filter = {"patient_id": patient.id}
        referral_filter = {"patient_id": patient.id}
        emergency_filter = {"patient_id": patient.id}
    elif user.role in {"doctor", "health_worker"}:
        referral_filter = {"referring_user_id": user.id}
    else:
        referral_filter = {"facility_id": user.facility_id, "status": {"$ne": "DRAFT"}}
        emergency_filter = {"selected_facility_id": user.facility_id}
    referrals = await db.referrals.find(referral_filter).sort("created_at", -1).limit(50).to_list(50)
    emergencies = await db.emergency_events.find(emergency_filter).sort("created_at", -1).limit(50).to_list(50)
    documents = await db.documents.find(document_filter).sort("created_at", -1).limit(50).to_list(50)
    return DashboardState(profile=profile, facilities=FACILITIES, referrals=parse_list(referrals, Referral), emergencies=parse_list(emergencies, EmergencyEvent), documents=parse_list(documents, Document))


@router.get("/patient/profile", response_model=PatientProfile)
async def get_patient_profile(user: UserRecord = Depends(require_roles("patient"))):
    return public_profile(await patient_for_user(user)).model_dump()


@router.put("/patient/profile", response_model=PatientProfile)
async def update_profile(input: ProfileUpdate, user: UserRecord = Depends(require_roles("patient"))):
    patient = await patient_for_user(user)
    try:
        phone = normalize_phone(input.mobile)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    updates = input.model_dump(exclude={"mobile"}) | {"phone_normalized": phone, "profile_complete": True, "updated_at": now_utc()}
    try:
        await db.patient_profiles.update_one({"id": patient.id}, {"$set": updates})
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="That phone number is already linked to another patient") from exc
    raw = await db.patient_profiles.find_one({"id": patient.id})
    return public_profile(PatientRecord(**raw)).model_dump()


@router.post("/assessment/session", response_model=AssessmentMessageResponse)
async def create_assessment(input: AssessmentSessionCreate, user: UserRecord = Depends(require_roles("patient"))):
    patient = await patient_for_user(user)
    session = AssessmentSession(patient_id=patient.id, symptoms=input.symptoms)
    await db.assessments.insert_one(session.model_dump())
    return AssessmentMessageResponse(session_id=session.id, question=QUESTIONS[0], question_index=0, total_questions=len(QUESTIONS), complete=False)


@router.post("/assessment/message", response_model=AssessmentMessageResponse)
async def assessment_message(input: AssessmentMessage, user: UserRecord = Depends(require_roles("patient"))):
    patient = await patient_for_user(user)
    raw = await db.assessments.find_one({"id": input.session_id, "patient_id": patient.id, "status": "active"})
    if not raw:
        raise HTTPException(status_code=404, detail="Assessment session not found or already completed")
    session = AssessmentSession(**raw)
    answers = [*session.answers, input.answer]
    next_index = session.question_index + 1
    if next_index >= len(QUESTIONS):
        final_answer = answers[-1].strip().lower()
        emergency = final_answer in {"difficulty breathing", "feeling faint", "both", "cannot breathe"}
        urgency = "EMERGENCY" if emergency else "ROUTINE"
        guidance = "Seek emergency help now and contact local emergency services." if emergency else "Based on your answers, please consult a doctor."
        updated = await db.assessments.update_one({"id": session.id, "status": "active"}, {"$set": {"answers": answers, "question_index": next_index, "status": "completed", "outcome": urgency, "guidance": guidance}})
        if updated.modified_count != 1:
            raise HTTPException(status_code=409, detail="Assessment answer was already submitted")
        return AssessmentMessageResponse(session_id=session.id, question_index=next_index, total_questions=len(QUESTIONS), complete=True, outcome=urgency, urgency=urgency, guidance=guidance)
    updated = await db.assessments.update_one({"id": session.id, "question_index": session.question_index}, {"$set": {"answers": answers, "question_index": next_index}})
    if updated.modified_count != 1:
        raise HTTPException(status_code=409, detail="Assessment answer was already submitted")
    return AssessmentMessageResponse(session_id=session.id, question=QUESTIONS[next_index], question_index=next_index, total_questions=len(QUESTIONS), complete=False)


@router.post("/doctor/assessment-assistance", response_model=DoctorAssessment)
async def doctor_assessment_assistance(input: DoctorAssessmentRequest, user: UserRecord = Depends(provider_roles)):
    await require_authorized_patient(user, input.access_request_id)
    text = f"{input.symptoms} {input.findings} {input.vitals}".lower()
    urgent = any(term in text for term in ["chest pain", "difficulty breathing", "faint", "unconscious"])
    if urgent:
        return DoctorAssessment(urgency="URGENT", care_requirement="Urgent clinical assessment", summary="Current structured symptoms include an urgent review criterion. Confirm severity and use emergency protocols if clinically indicated.", suggested_capabilities=["Emergency", "ECG", "Diagnostics"])
    return DoctorAssessment(summary="Current symptoms and findings support a routine clinical review. Confirm or change this assessment before referral.", suggested_capabilities=["Primary Care", "Internal Medicine", "Diagnostics"])


@router.get("/facilities/match", response_model=FacilityMatchResponse)
async def facilities_match(requirement: Annotated[str, Query()] = "ROUTINE", _: UserRecord = Depends(get_current_user)):
    normalized = requirement.upper()
    if normalized in {"EMERGENCY", "URGENT", "EMERGENCY_CARE"}:
        matches = [facility for facility in FACILITIES if facility.emergency_ready]
    else:
        matches = [FACILITIES[2], FACILITIES[0], FACILITIES[1]]
    return FacilityMatchResponse(requirement=normalized, facilities=matches[:3])


@router.post("/referrals", response_model=Referral)
async def create_referral(input: ReferralCreate, user: UserRecord = Depends(provider_roles)):
    existing = await db.referrals.find_one({"idempotency_key": input.idempotency_key})
    if existing:
        if existing.get("referring_user_id") != user.id:
            raise HTTPException(status_code=409, detail="Duplicate referral request")
        return Referral(**existing)
    patient = await require_authorized_patient(user, input.access_request_id)
    facility = facility_by_id(input.facility_id)
    referral = Referral(
        idempotency_key=input.idempotency_key,
        patient_id=patient.id,
        patient_code=patient.patient_code,
        patient_name=patient.name,
        patient_summary=ReferralPatientSnapshot(age=patient.age, gender=patient.gender, blood_group=patient.blood_group, existing_conditions=patient.existing_conditions, allergies=patient.allergies, medicines=patient.medicines),
        access_request_id=input.access_request_id,
        referring_user_id=user.id,
        referring_provider_name=user.display_name,
        facility_id=facility.id,
        facility_name=facility.name,
        reason=input.reason,
        care_requirement=input.care_requirement,
        urgency=input.urgency,
        symptoms=input.symptoms,
        findings=input.findings,
        vitals=input.vitals,
        ai_assessment=input.ai_assessment,
        doctor_decision=input.doctor_decision,
        events=[Event(label="DRAFT", detail="Referral draft created", actor_user_id=user.id, actor_role=user.role)],
    )
    try:
        await db.referrals.insert_one(referral.model_dump())
    except DuplicateKeyError:
        existing = await db.referrals.find_one({"idempotency_key": input.idempotency_key})
        return Referral(**existing)
    return referral


@router.post("/referrals/{referral_id}/confirm", response_model=Referral)
async def confirm_referral(referral_id: str, user: UserRecord = Depends(provider_roles)):
    now = now_utc()
    events = [
        Event(label="CONFIRMED", detail="Doctor confirmed the referral", actor_user_id=user.id, actor_role=user.role).model_dump(),
        Event(label="SENT", detail="Referral sent to receiving hospital", actor_user_id=user.id, actor_role=user.role).model_dump(),
        Event(label="RECEIVED", detail="Stored in the hospital queue", actor_user_id="system", actor_role="system").model_dump(),
    ]
    raw = await db.referrals.find_one_and_update({"id": referral_id, "referring_user_id": user.id, "status": "DRAFT"}, {"$set": {"status": "RECEIVED", "updated_at": now}, "$push": {"events": {"$each": events}}}, return_document=ReturnDocument.AFTER)
    if not raw:
        existing = await db.referrals.find_one({"id": referral_id, "referring_user_id": user.id})
        if existing and existing.get("status") != "DRAFT":
            return Referral(**existing)
        raise HTTPException(status_code=404, detail="Referral draft not found")
    await record_audit(user, "REFERRAL_CONFIRMED", raw["patient_id"], resource_id=referral_id)
    return Referral(**raw)


@router.post("/referrals/{referral_id}/status", response_model=Referral)
async def update_referral_status(referral_id: str, input: ReferralActionRequest, user: UserRecord = Depends(hospital_roles)):
    raw = await db.referrals.find_one({"id": referral_id, "facility_id": user.facility_id})
    if not raw:
        raise HTTPException(status_code=404, detail="Referral not found in this hospital queue")
    referral = Referral(**raw)
    allowed = {"RECEIVED": {"ACCEPTED", "REJECTED", "REDIRECTED"}, "ACCEPTED": {"ARRIVED"}, "ARRIVED": {"COMPLETED"}}
    if input.status not in allowed.get(referral.status, set()):
        raise HTTPException(status_code=409, detail=f"Cannot move referral from {referral.status} to {input.status}")
    if input.status in {"REJECTED", "REDIRECTED"} and not input.reason:
        raise HTTPException(status_code=422, detail="A reason is required for rejection or redirection")
    if input.status == "COMPLETED" and user.role != "hospital_doctor":
        raise HTTPException(status_code=403, detail="Only a hospital doctor can record a clinical outcome")
    if input.status == "COMPLETED" and not input.outcome:
        raise HTTPException(status_code=422, detail="An outcome is required to complete a referral")
    event = Event(label=input.status, detail=input.reason or input.outcome or "Hospital workflow update", actor_user_id=user.id, actor_role=user.role)
    set_fields: dict = {"status": input.status, "updated_at": now_utc()}
    if input.outcome:
        set_fields["outcome"] = input.outcome
    updated = await db.referrals.find_one_and_update({"id": referral_id, "status": referral.status}, {"$set": set_fields, "$push": {"events": event.model_dump()}}, return_document=ReturnDocument.AFTER)
    if not updated:
        raise HTTPException(status_code=409, detail="Referral changed; refresh before trying again")
    await record_audit(user, f"REFERRAL_{input.status}", referral.patient_id, input.reason or input.outcome, referral.id)
    return Referral(**updated)


@router.post("/sos", response_model=SOSResponse)
async def create_sos(input: SOSCreate, user: UserRecord = Depends(require_roles("patient"))):
    existing = await db.emergency_events.find_one({"idempotency_key": input.idempotency_key, "patient_id": user.patient_id})
    if existing:
        return SOSResponse(event=EmergencyEvent(**existing), facilities=[facility for facility in FACILITIES if facility.emergency_ready], message="Emergency action already initiated. Simulated dispatch remains active.")
    patient = await patient_for_user(user)
    event = EmergencyEvent(idempotency_key=input.idempotency_key, patient_id=patient.id, patient_code=patient.patient_code, patient_name=patient.name, note=input.note)
    await db.emergency_events.insert_one(event.model_dump())
    await record_audit(user, "SOS_INITIATED", patient.id, "Simulated ambulance dispatch initiated", event.id)
    return SOSResponse(event=event, facilities=[facility for facility in FACILITIES if facility.emergency_ready], message="Emergency action initiated. Simulated ambulance dispatch recorded immediately.")


@router.post("/sos/{sos_id}/context", response_model=EmergencyEvent)
async def update_sos_context(sos_id: str, input: SOSContextUpdate, user: UserRecord = Depends(require_roles("patient"))):
    raw = await db.emergency_events.find_one_and_update({"id": sos_id, "patient_id": user.patient_id}, {"$set": {"note": input.note, "updated_at": now_utc()}}, return_document=ReturnDocument.AFTER)
    if not raw:
        raise HTTPException(status_code=404, detail="Emergency event not found")
    return EmergencyEvent(**raw)


@router.post("/sos/select-facility", response_model=SOSResponse)
async def select_sos_facility(input: SOSFacilitySelect, user: UserRecord = Depends(require_roles("patient"))):
    event_raw = await db.emergency_events.find_one({"id": input.sos_id, "patient_id": user.patient_id})
    if not event_raw:
        raise HTTPException(status_code=404, detail="Emergency event not found")
    event = EmergencyEvent(**event_raw)
    if event.selected_facility_id:
        return SOSResponse(event=event, facilities=[facility for facility in FACILITIES if facility.emergency_ready], message="Hospital already notified for this emergency event.")
    facility = facility_by_id(input.facility_id)
    if not facility.emergency_ready:
        raise HTTPException(status_code=422, detail="Selected facility is not configured for emergency intake")
    claimed = await db.emergency_events.find_one_and_update({"id": event.id, "selected_facility_id": None}, {"$set": {"selected_facility_id": facility.id, "selected_facility_name": facility.name, "status": "HOSPITAL_ALERT_PENDING", "updated_at": now_utc()}}, return_document=ReturnDocument.AFTER)
    if not claimed:
        existing = await db.emergency_events.find_one({"id": event.id})
        return SOSResponse(event=EmergencyEvent(**existing), facilities=[item for item in FACILITIES if item.emergency_ready], message="Hospital already notified for this emergency event.")
    patient = await patient_for_user(user)
    referral = Referral(
        idempotency_key=f"sos:{event.id}",
        patient_id=patient.id,
        patient_code=patient.patient_code,
        patient_name=patient.name,
        patient_summary=ReferralPatientSnapshot(age=patient.age, gender=patient.gender, blood_group=patient.blood_group, existing_conditions=patient.existing_conditions, allergies=patient.allergies, medicines=patient.medicines),
        facility_id=facility.id,
        facility_name=facility.name,
        reason="Emergency SOS destination selected",
        care_requirement="Emergency evaluation",
        urgency="EMERGENCY",
        doctor_decision="Emergency destination selected by patient/guardian workflow",
        status="RECEIVED",
        emergency=True,
        events=[
            Event(label="DRAFT", detail="Emergency referral created", actor_user_id=user.id, actor_role=user.role),
            Event(label="CONFIRMED", detail="Emergency workflow confirmed destination", actor_user_id=user.id, actor_role=user.role),
            Event(label="SENT", detail="Emergency alert sent", actor_user_id="system", actor_role="system"),
            Event(label="RECEIVED", detail="Stored in hospital emergency queue", actor_user_id="system", actor_role="system"),
        ],
    )
    await db.referrals.insert_one(referral.model_dump())
    updated = await db.emergency_events.find_one_and_update({"id": event.id}, {"$set": {"status": "HOSPITAL_ALERTED", "referral_id": referral.id, "updated_at": now_utc()}}, return_document=ReturnDocument.AFTER)
    await record_audit(user, "SOS_DESTINATION_SELECTED", patient.id, facility.name, event.id)
    return SOSResponse(event=EmergencyEvent(**updated), facilities=[item for item in FACILITIES if item.emergency_ready], message="Hospital notified. The emergency referral is visible in the receiving queue.")


@router.get("/hospital/queue", response_model=HospitalQueue)
async def hospital_queue(user: UserRecord = Depends(hospital_roles)):
    emergencies = await db.emergency_events.find({"selected_facility_id": user.facility_id}).sort("created_at", -1).limit(50).to_list(50)
    referrals = await db.referrals.find({"facility_id": user.facility_id, "status": {"$ne": "DRAFT"}}).sort("created_at", -1).limit(50).to_list(50)
    return HospitalQueue(emergencies=parse_list(emergencies, EmergencyEvent), referrals=parse_list(referrals, Referral))


@router.post("/documents/upload", response_model=Document)
async def upload_document(file: UploadFile = File(...), user: UserRecord = Depends(require_roles("patient"))):
    patient = await patient_for_user(user)
    filename = Path(file.filename or "medical-report").name
    allowed = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=415, detail="Upload a PDF, JPG, PNG, or WEBP medical document")
    data = await file.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Document exceeds the 10 MB demo limit")
    if not data:
        raise HTTPException(status_code=422, detail="Document is empty")
    document_id = str(uuid.uuid4())
    storage_name = f"{document_id}-{filename}"
    unreadable = "unreadable" in filename.lower()
    document = Document(id=document_id, patient_id=patient.id, filename=filename, storage_name=storage_name, content_type=file.content_type, size_bytes=len(data), review_status="unreadable" if unreadable else "needs_verification", extracted_fields=[] if unreadable else ["Hypertension", "BP 150/90", "Medication: Amlodipine"])
    (UPLOAD_DIR / storage_name).write_bytes(data)
    await db.documents.insert_one(document.model_dump())
    return document


@router.post("/documents/{document_id}/review", response_model=Document)
async def review_document(document_id: str, input: DocumentReviewRequest, user: UserRecord = Depends(provider_roles)):
    patient = await require_authorized_patient(user, input.access_request_id)
    raw = await db.documents.find_one({"id": document_id, "patient_id": patient.id})
    if not raw:
        raise HTTPException(status_code=404, detail="Document not found for the authorized patient")
    document = Document(**raw)
    if document.review_status == "unreadable" and input.decision == "verified":
        raise HTTPException(status_code=400, detail="Unreadable extraction cannot be verified")
    updated = await db.documents.find_one_and_update({"id": document_id}, {"$set": {"review_status": input.decision, "review_actor_user_id": user.id, "reviewed_at": now_utc()}}, return_document=ReturnDocument.AFTER)
    await record_audit(user, f"DOCUMENT_{input.decision.upper()}", patient.id, resource_id=document_id)
    return Document(**updated)


@router.get("/documents/{document_id}/content")
async def document_content(document_id: str, access_request_id: str | None = None, user: UserRecord = Depends(get_current_user)):
    raw = await db.documents.find_one({"id": document_id})
    if not raw:
        raise HTTPException(status_code=404, detail="Document not found")
    if user.role == "patient":
        if raw["patient_id"] != user.patient_id:
            raise HTTPException(status_code=403, detail="Document access denied")
    else:
        if not access_request_id:
            raise HTTPException(status_code=403, detail="Authorized patient access is required")
        patient = await require_authorized_patient(user, access_request_id)
        if patient.id != raw["patient_id"]:
            raise HTTPException(status_code=403, detail="Document access denied")
    path = UPLOAD_DIR / raw["storage_name"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Original document is unavailable")
    return FileResponse(path, media_type=raw["content_type"], filename=raw["filename"])


@router.post("/admin/reset-demo")
async def reset_demo(_: UserRecord = Depends(require_roles("hospital_admin"))):
    await reset_demo_data()
    return {"message": "Demo data reset. Sign in again with a seeded account."}