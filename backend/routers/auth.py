import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from lib.db import db
from models.auth import LoginRequest, SessionUser, UserRecord
from services.security import SESSION_COOKIE, SESSION_TTL_HOURS, create_session, get_current_user, revoke_session, session_user, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=SessionUser)
async def login(input: LoginRequest, response: Response, request: Request):
    raw = await db.users.find_one({"email": input.email.lower(), "active": True})
    if not raw or not verify_password(input.password, raw["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    user = UserRecord(**raw)
    token, _ = await create_session(user.id)
    secure_setting = os.environ.get("COOKIE_SECURE", "auto").lower()
    forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    secure_cookie = secure_setting == "true" or (secure_setting == "auto" and forwarded_proto == "https")
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        max_age=SESSION_TTL_HOURS * 3600,
        path="/",
    )
    return await session_user(user)


@router.get("/me", response_model=SessionUser)
async def me(user: UserRecord = Depends(get_current_user)):
    return await session_user(user)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response):
    await revoke_session(request.cookies.get(SESSION_COOKIE))
    response.delete_cookie(SESSION_COOKIE, path="/")