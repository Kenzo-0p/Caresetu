from datetime import timedelta
import hashlib
import os
import re
import secrets
import string
import uuid

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from lib.db import db
from lib.dates import now_utc
from models.auth import UserRecord
from models.identity import AuditEvent, IdentityPreview, PatientProfile, PatientRecord
from services.security import hash_secret, pwd_context


PATIENT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
PATIENT_CODE_RE = re.compile(r"^PAT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$")
QR_PAYLOAD_RE = re.compile(r"^caresetu://patient/([A-Za-z0-9_-]{32,128})$")
ACCESS_TTL_MINUTES = 15
CONSENT_TTL_MINUTES = 10
QR_TTL_HOURS = 24
LOOKUP_LIMIT_PER_MINUTE = int(os.environ.get("LOOKUP_LIMIT_PER_MINUTE", "30"))


def normalize_phone(value: str, default_country_code: str = "91") -> str:
    raw = value.strip()
    explicit_plus = raw.startswith("+")
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("00"):
        digits = digits[2:]
        explicit_plus = True
    if not explicit_plus:
        if len(digits) == 10:
            digits = f"{default_country_code}{digits}"
        elif len(digits) == 11 and digits.startswith("0"):
            digits = f"{default_country_code}{digits[1:]}"
    if not 10 <= len(digits) <= 15:
        raise ValueError("Enter a valid phone number with country code")
    return f"+{digits}"


def generate_patient_code() -> str:
    return "PAT-" + "".join(secrets.choice(PATIENT_CODE_ALPHABET) for _ in range(6))


async def reserve_patient_code(max_attempts: int = 12) -> str:
    for _ in range(max_attempts):
        code = generate_patient_code()
        if not await db.patient_profiles.find_one({"patient_code": code}, {"_id": 1}):
            return code
    raise RuntimeError("Unable to reserve a unique Patient Code")


async def create_patient(record: PatientRecord, max_attempts: int = 12) -> PatientRecord:
    candidate = record
    for _ in range(max_attempts):
        try:
            await db.patient_profiles.insert_one(candidate.model_dump())
            return candidate
        except DuplicateKeyError as exc:
            if "patient_code" not in str(exc):
                raise
            candidate.patient_code = generate_patient_code()
    raise RuntimeError("Unable to create patient after Patient Code collisions")


def public_profile(record: PatientRecord) -> PatientProfile:
    return PatientProfile(
        patient_code=record.patient_code,
        name=record.name,
        age=record.age,
        gender=record.gender,
        mobile=record.phone_normalized,
        location=record.location,
        address=record.address,
        emergency_contact=record.emergency_contact,
        blood_group=record.blood_group,
        weight_kg=record.weight_kg,
        existing_conditions=record.existing_conditions,
        allergies=record.allergies,
        medicines=record.medicines,
        previous_history=record.previous_history,
        profile_complete=record.profile_complete,
    )


def mask_phone(phone: str) -> str:
    return f"{phone[:3]}••••••{phone[-3:]}"


async def issue_qr_token(patient_id: str) -> tuple[str, object]:
    token = secrets.token_urlsafe(32)
    expires_at = now_utc() + timedelta(hours=QR_TTL_HOURS)
    await db.patient_profiles.update_one({"id": patient_id}, {"$set": {"qr_token_hash": hash_secret(token), "qr_expires_at": expires_at, "updated_at": now_utc()}})
    return f"caresetu://patient/{token}", expires_at


async def resolve_patient(method: str, value: str) -> PatientRecord | None:
    now = now_utc()
    if method == "patient_code":
        code = value.strip().upper()
        if not PATIENT_CODE_RE.fullmatch(code):
            raise HTTPException(status_code=422, detail="Patient Code must use the format PAT-XXXXXX")
        raw = await db.patient_profiles.find_one({"patient_code": code})
    elif method == "phone":
        try:
            phone = normalize_phone(value)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        matches = await db.patient_profiles.find({"phone_normalized": phone}).limit(2).to_list(2)
        if len(matches) > 1:
            raise HTTPException(status_code=409, detail="Identity could not be resolved safely")
        raw = matches[0] if matches else None
    elif method == "qr":
        match = QR_PAYLOAD_RE.fullmatch(value.strip())
        if not match:
            raise HTTPException(status_code=422, detail="QR value is invalid or manipulated")
        raw = await db.patient_profiles.find_one({"qr_token_hash": hash_secret(match.group(1)), "qr_expires_at": {"$gt": now}})
    else:
        raise HTTPException(status_code=422, detail="Unsupported identity method")
    return PatientRecord(**raw) if raw else None


async def enforce_lookup_limit(actor_id: str) -> None:
    now = now_utc()
    since = now - timedelta(minutes=1)
    count = await db.lookup_attempts.count_documents({"actor_user_id": actor_id, "created_at": {"$gte": since}})
    if count >= LOOKUP_LIMIT_PER_MINUTE:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many identity attempts. Wait one minute and try again.")
    await db.lookup_attempts.insert_one({"actor_user_id": actor_id, "created_at": now})


async def create_access_request(user: UserRecord, patient: PatientRecord, method: str) -> IdentityPreview:
    now = now_utc()
    request_id = str(uuid.uuid4())
    expires_at = now + timedelta(minutes=ACCESS_TTL_MINUTES)
    await db.access_requests.insert_one({
        "id": request_id,
        "actor_user_id": user.id,
        "actor_role": user.role,
        "patient_id": patient.id,
        "method": method,
        "status": "PENDING",
        "created_at": now,
        "expires_at": expires_at,
    })
    return IdentityPreview(
        access_request_id=request_id,
        patient_code=patient.patient_code,
        name=patient.name,
        age=patient.age,
        gender=patient.gender,
        masked_phone=mask_phone(patient.phone_normalized),
        method=method,
        expires_at=expires_at,
    )


async def generate_consent_code(patient_id: str) -> tuple[str, object]:
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = now_utc() + timedelta(minutes=CONSENT_TTL_MINUTES)
    await db.patient_profiles.update_one({"id": patient_id}, {"$set": {"consent_code_hash": pwd_context.hash(code), "consent_expires_at": expires_at, "consent_used_at": None}})
    return code, expires_at


async def authorize_access(user: UserRecord, access_request_id: str, consent_code: str) -> tuple[PatientRecord, object]:
    now = now_utc()
    request = await db.access_requests.find_one({"id": access_request_id, "actor_user_id": user.id, "status": "PENDING", "expires_at": {"$gt": now}})
    if not request:
        raise HTTPException(status_code=404, detail="Access request is invalid or expired")
    raw_patient = await db.patient_profiles.find_one({"id": request["patient_id"]})
    if not raw_patient:
        raise HTTPException(status_code=404, detail="Access request is invalid or expired")
    patient = PatientRecord(**raw_patient)
    if not patient.consent_code_hash or not patient.consent_expires_at or patient.consent_expires_at <= now or patient.consent_used_at:
        raise HTTPException(status_code=403, detail="Patient consent code is invalid or expired")
    if not pwd_context.verify(consent_code, patient.consent_code_hash):
        raise HTTPException(status_code=403, detail="Patient consent code is invalid or expired")
    access_expires_at = now + timedelta(hours=1)
    updated = await db.access_requests.update_one({"id": access_request_id, "status": "PENDING"}, {"$set": {"status": "AUTHORIZED", "authorized_at": now, "access_expires_at": access_expires_at}})
    if updated.modified_count != 1:
        raise HTTPException(status_code=409, detail="Access request was already used")
    await db.patient_profiles.update_one({"id": patient.id}, {"$set": {"consent_used_at": now}})
    await record_audit(user, "NORMAL_ACCESS_AUTHORIZED", patient.id, "One-time patient consent code verified", access_request_id)
    return patient, access_expires_at


async def require_authorized_patient(user: UserRecord, access_request_id: str) -> PatientRecord:
    request = await db.access_requests.find_one({"id": access_request_id, "actor_user_id": user.id, "status": {"$in": ["AUTHORIZED", "BREAK_GLASS"]}, "access_expires_at": {"$gt": now_utc()}})
    if not request:
        raise HTTPException(status_code=403, detail="Authorized patient access is required")
    raw = await db.patient_profiles.find_one({"id": request["patient_id"]})
    if not raw:
        raise HTTPException(status_code=404, detail="Patient record unavailable")
    return PatientRecord(**raw)


async def record_audit(user: UserRecord, action: str, patient_id: str | None = None, reason: str | None = None, resource_id: str | None = None) -> AuditEvent:
    event = AuditEvent(actor_user_id=user.id, actor_role=user.role, patient_id=patient_id, action=action, reason=reason, resource_id=resource_id)
    await db.audit_logs.insert_one(event.model_dump())
    return event