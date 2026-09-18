from datetime import timedelta
import hashlib
import os
import secrets

from fastapi import Depends, HTTPException, Request, status
from passlib.context import CryptContext

from lib.db import db
from lib.dates import now_utc
from models.auth import Role, SessionUser, UserRecord


SESSION_COOKIE = "caresetu_session"
SESSION_TTL_HOURS = int(os.environ.get("SESSION_TTL_HOURS", "12"))
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


async def create_session(user_id: str) -> tuple[str, object]:
    token = secrets.token_urlsafe(48)
    now = now_utc()
    expires_at = now + timedelta(hours=SESSION_TTL_HOURS)
    await db.sessions.insert_one({
        "token_hash": hash_secret(token),
        "user_id": user_id,
        "created_at": now,
        "expires_at": expires_at,
        "last_seen_at": now,
    })
    return token, expires_at


async def revoke_session(token: str | None) -> None:
    if token:
        await db.sessions.delete_one({"token_hash": hash_secret(token)})


async def get_current_user(request: Request) -> UserRecord:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    now = now_utc()
    session = await db.sessions.find_one({"token_hash": hash_secret(token), "expires_at": {"$gt": now}})
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or invalid")
    raw_user = await db.users.find_one({"id": session["user_id"], "active": True})
    if not raw_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account unavailable")
    await db.sessions.update_one({"_id": session["_id"]}, {"$set": {"last_seen_at": now}})
    return UserRecord(**raw_user)


def require_roles(*roles: Role):
    async def role_dependency(user: UserRecord = Depends(get_current_user)) -> UserRecord:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This role cannot perform that action")
        return user
    return role_dependency


async def session_user(user: UserRecord) -> SessionUser:
    patient_code = None
    if user.patient_id:
        patient = await db.patient_profiles.find_one({"id": user.patient_id}, {"patient_code": 1})
        patient_code = patient.get("patient_code") if patient else None
    return SessionUser(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        patient_code=patient_code,
        facility_id=user.facility_id,
    )