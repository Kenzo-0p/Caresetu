from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from lib.db import client, ensure_indexes
from routers.auth import router as auth_router
from routers.demo import router as clinical_router
from routers.identity import router as identity_router
from services.seed import ensure_demo_seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_demo_seed()
    await ensure_indexes()
    yield
    client.close()


app = FastAPI(title="CareSetu Smart Healthcare MVP", lifespan=lifespan)
api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(identity_router)
api_router.include_router(clinical_router)

origins = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

# Keep this as the last statement: every endpoint is served under /api.
app.include_router(api_router)