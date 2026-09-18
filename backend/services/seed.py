import os

from lib.db import db
from lib.dates import now_utc
from models.identity import PatientRecord
from services.security import hash_password


DEMO_USERS = [
    {"id": "user-patient-maya", "email": "patient@caresetu.demo", "password": "Patient123!", "display_name": "Maya Sharma", "role": "patient", "patient_id": "11111111-1111-4111-8111-111111111111", "facility_id": None},
    {"id": "user-doctor-anika", "email": "doctor@caresetu.demo", "password": "Doctor123!", "display_name": "Dr. Anika Rao", "role": "doctor", "patient_id": None, "facility_id": None},
    {"id": "user-worker-kiran", "email": "worker@caresetu.demo", "password": "Worker123!", "display_name": "Kiran Das", "role": "health_worker", "patient_id": None, "facility_id": None},
    {"id": "user-hospital-doctor", "email": "hospital.doctor@caresetu.demo", "password": "Hospital123!", "display_name": "Dr. Neel Shah", "role": "hospital_doctor", "patient_id": None, "facility_id": "facility-a"},
    {"id": "user-hospital-admin", "email": "hospital.admin@caresetu.demo", "password": "Admin123!", "display_name": "Harborview Operations", "role": "hospital_admin", "patient_id": None, "facility_id": "facility-a"},
]


async def ensure_demo_seed() -> None:
    if os.environ.get("DEMO_SEED_ON_START", "true").lower() != "true":
        return
    if await db.users.count_documents({}) > 0:
        return
    for name in ["patient_profiles", "assessments", "referrals", "emergency_events", "documents", "sessions", "access_requests", "audit_logs", "lookup_attempts"]:
        await db[name].delete_many({})
    now = now_utc()
    for item in DEMO_USERS:
        user = {key: value for key, value in item.items() if key != "password"}
        user["password_hash"] = hash_password(item["password"])
        user["active"] = True
        user["created_at"] = now
        await db.users.insert_one(user)
    patient = PatientRecord(
        id="11111111-1111-4111-8111-111111111111",
        owner_user_id="user-patient-maya",
        patient_code="PAT-7K4M92",
        phone_normalized="+919876543210",
        name="Maya Sharma",
        age=29,
        gender="Female",
        location="Bengaluru, Karnataka",
        address="14 Lake View Road, Bengaluru",
        emergency_contact="Arjun Sharma · +91 98765 40001",
        blood_group="O+",
        weight_kg=58,
        existing_conditions=["Mild asthma"],
        allergies=["Penicillin"],
        medicines=["Salbutamol inhaler · as needed"],
        previous_history=["Asthma review · Jan 2026"],
        profile_complete=True,
    )
    await db.patient_profiles.insert_one(patient.model_dump())


async def reset_demo_data() -> None:
    await db.users.delete_many({})
    await ensure_demo_seed()