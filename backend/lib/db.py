"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel
from pymongo.errors import OperationFailure

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url, tz_aware=True)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [
        IndexModel([("id", ASCENDING)], name="user_id", unique=True),
        IndexModel([("email", ASCENDING)], name="user_email", unique=True),
    ],
    "sessions": [
        IndexModel([("token_hash", ASCENDING)], name="session_token", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="session_expiry", expireAfterSeconds=0),
    ],
    "patient_profiles": [
        IndexModel([("id", ASCENDING)], name="patient_id", unique=True),
        IndexModel([("owner_user_id", ASCENDING)], name="patient_owner", unique=True, partialFilterExpression={"owner_user_id": {"$type": "string"}}),
        IndexModel([("patient_code", ASCENDING)], name="patient_code", unique=True),
        IndexModel([("phone_normalized", ASCENDING)], name="patient_phone", unique=True),
        IndexModel([("qr_token_hash", ASCENDING)], name="patient_qr_token", unique=True, partialFilterExpression={"qr_token_hash": {"$type": "string"}}),
    ],
    "assessments": [
        IndexModel([("id", ASCENDING)], name="assessment_id", unique=True),
        IndexModel([("patient_id", ASCENDING), ("created_at", DESCENDING)], name="assessment_patient"),
    ],
    "access_requests": [
        IndexModel([("id", ASCENDING)], name="access_request_id", unique=True),
        IndexModel([("actor_user_id", ASCENDING), ("patient_id", ASCENDING), ("status", ASCENDING)], name="access_actor_patient"),
    ],
    "lookup_attempts": [IndexModel([("created_at", ASCENDING)], name="lookup_attempt_expiry", expireAfterSeconds=3600)],
    "audit_logs": [IndexModel([("patient_id", ASCENDING), ("created_at", DESCENDING)], name="audit_patient")],
    "referrals": [
        IndexModel([("id", ASCENDING)], name="referral_id", unique=True),
        IndexModel([("idempotency_key", ASCENDING)], name="referral_idempotency", unique=True),
        IndexModel([("facility_id", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)], name="referral_queue"),
        IndexModel([("patient_id", ASCENDING), ("created_at", DESCENDING)], name="referral_patient"),
    ],
    "emergency_events": [
        IndexModel([("id", ASCENDING)], name="emergency_id", unique=True),
        IndexModel([("idempotency_key", ASCENDING)], name="emergency_idempotency", unique=True),
        IndexModel([("selected_facility_id", ASCENDING), ("created_at", DESCENDING)], name="emergency_facility"),
    ],
    "documents": [
        IndexModel([("id", ASCENDING)], name="document_id", unique=True),
        IndexModel([("patient_id", ASCENDING), ("created_at", DESCENDING)], name="document_patient"),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except OperationFailure as exc:
                if exc.code not in {85, 86}:
                    logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
                    continue
                await db[collection].drop_index(model.document["name"])
                await db[collection].create_indexes([model])
                logger.info("Replaced stale index %s.%s", collection, model.document["name"])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
