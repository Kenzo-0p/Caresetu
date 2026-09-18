from base64 import b64encode
from io import BytesIO
import qrcode
import qrcode.image.svg

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.dates import now_utc
from models.auth import UserRecord
from models.identity import (
    AuthorizedPatientAccess,
    AuthorizeAccessRequest,
    BreakGlassRequest,
    ConsentCodeResponse,
    IdentityLookupRequest,
    IdentityPreview,
    PatientIdentity,
    PatientRecord,
)
from services.identity import (
    authorize_access,
    create_access_request,
    enforce_lookup_limit,
    generate_consent_code,
    issue_qr_token,
    public_profile,
    record_audit,
    resolve_patient,
)
from services.security import get_current_user, require_roles


router = APIRouter(tags=["identity"])
provider_roles = require_roles("doctor", "health_worker", "hospital_doctor", "hospital_admin")


def qr_svg_data_url(payload: str) -> str:
    image = qrcode.make(payload, image_factory=qrcode.image.svg.SvgPathImage, box_size=8, border=3)
    buffer = BytesIO()
    image.save(buffer)
    return "data:image/svg+xml;base64," + b64encode(buffer.getvalue()).decode("ascii")


@router.get("/patient/identity", response_model=PatientIdentity)
async def patient_identity(user: UserRecord = Depends(require_roles("patient"))):
    raw = await db.patient_profiles.find_one({"id": user.patient_id})
    if not raw:
        raise HTTPException(status_code=404, detail="Patient profile unavailable")
    patient = PatientRecord(**raw)
    payload, expires_at = await issue_qr_token(patient.id)
    return PatientIdentity(patient_code=patient.patient_code, normalized_phone=patient.phone_normalized, qr_payload=payload, qr_svg_data_url=qr_svg_data_url(payload), qr_expires_at=expires_at)


@router.post("/patient/identity/refresh-qr", response_model=PatientIdentity)
async def refresh_qr(user: UserRecord = Depends(require_roles("patient"))):
    return await patient_identity(user)


@router.post("/patient/identity/consent-code", response_model=ConsentCodeResponse)
async def consent_code(user: UserRecord = Depends(require_roles("patient"))):
    code, expires_at = await generate_consent_code(user.patient_id or "")
    await record_audit(user, "CONSENT_CODE_ISSUED", user.patient_id)
    return ConsentCodeResponse(consent_code=code, expires_at=expires_at)


@router.post("/provider/identify", response_model=IdentityPreview)
async def identify_patient(input: IdentityLookupRequest, user: UserRecord = Depends(provider_roles)):
    await enforce_lookup_limit(user.id)
    patient = await resolve_patient(input.method, input.value)
    if not patient:
        raise HTTPException(status_code=404, detail="No matching patient identity was found")
    await record_audit(user, "PATIENT_IDENTITY_MATCHED", patient.id, f"Method: {input.method}")
    return await create_access_request(user, patient, input.method)


@router.post("/provider/access/{access_request_id}/authorize", response_model=AuthorizedPatientAccess)
async def provider_authorize(access_request_id: str, input: AuthorizeAccessRequest, user: UserRecord = Depends(provider_roles)):
    patient, expires_at = await authorize_access(user, access_request_id, input.consent_code)
    documents = await db.documents.find({"patient_id": patient.id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    referrals = await db.referrals.find({"patient_id": patient.id, "status": {"$ne": "DRAFT"}}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return AuthorizedPatientAccess(access_request_id=access_request_id, patient=public_profile(patient), expires_at=expires_at, access_note="One-time patient authorization verified and audit logged.", documents=documents, prior_referrals=referrals)


@router.post("/provider/break-glass", response_model=AuthorizedPatientAccess)
async def break_glass(input: BreakGlassRequest, user: UserRecord = Depends(provider_roles)):
    patient = await resolve_patient(input.method, input.value)
    if not patient:
        raise HTTPException(status_code=404, detail="Emergency identity could not be resolved")
    emergency = await db.emergency_events.find_one({"id": input.emergency_event_id, "patient_id": patient.id})
    if not emergency:
        raise HTTPException(status_code=403, detail="A matching active emergency event is required")
    now = now_utc()
    preview = await create_access_request(user, patient, input.method)
    expires_at = now.replace(microsecond=0)
    from datetime import timedelta
    expires_at = expires_at + timedelta(minutes=30)
    await db.access_requests.update_one({"id": preview.access_request_id}, {"$set": {"status": "BREAK_GLASS", "authorized_at": now, "access_expires_at": expires_at, "reason": input.reason, "emergency_event_id": input.emergency_event_id}})
    await record_audit(user, "BREAK_GLASS_ACCESS", patient.id, input.reason, input.emergency_event_id)
    documents = await db.documents.find({"patient_id": patient.id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    referrals = await db.referrals.find({"patient_id": patient.id, "status": {"$ne": "DRAFT"}}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return AuthorizedPatientAccess(access_request_id=preview.access_request_id, patient=public_profile(patient), expires_at=expires_at, access_note="Emergency break-glass access granted for this event and audit logged.", documents=documents, prior_referrals=referrals)