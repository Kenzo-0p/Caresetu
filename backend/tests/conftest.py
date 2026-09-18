"""Pre-scaffolded pytest fixtures for the FastAPI backend.

Tests hit the live uvicorn process managed by supervisor (not an in-process ASGI app), so
the app under test is the same one the frontend and Playwright see. Do NOT re-create this
file — add app-specific fixtures below the marker at the bottom.
"""

import os

import httpx
import pytest
import pytest_asyncio

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
API_URL = f"{BACKEND_URL}/api"


def api_url(path: str = "") -> str:
    """Absolute URL for an /api route: api_url("/status") -> http://localhost:8001/api/status."""
    return f"{API_URL}{path}"


@pytest.fixture(scope="session")
def backend_url() -> str:
    return BACKEND_URL


@pytest.fixture
def client():
    """Sync httpx client rooted at /api — the default for endpoint tests.

    Example:
        def test_status(client):
            assert client.get("/status").status_code == 200
    """
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        yield c


@pytest_asyncio.fixture
async def aclient():
    """Async variant, for tests that also await motor/backend helpers directly."""
    async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as c:
        yield c


# --- app-specific fixtures below this line ---

DEMO_CREDENTIALS = {
    "patient": ("patient@caresetu.demo", "Patient123!"),
    "doctor": ("doctor@caresetu.demo", "Doctor123!"),
    "worker": ("worker@caresetu.demo", "Worker123!"),
    "hospital_doctor": ("hospital.doctor@caresetu.demo", "Hospital123!"),
    "hospital_admin": ("hospital.admin@caresetu.demo", "Admin123!"),
}


@pytest.fixture
def login(client):
    def _login(role: str) -> dict:
        client.cookies.clear()
        email, password = DEMO_CREDENTIALS[role]
        response = client.post("/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        return response.json()
    return _login


@pytest.fixture
def authorize_doctor(client, login):
    def _authorize(method: str = "patient_code") -> dict:
        login("patient")
        identity = client.get("/patient/identity").json()
        consent = client.post("/patient/identity/consent-code").json()["consent_code"]
        values = {
            "patient_code": identity["patient_code"],
            "phone": identity["normalized_phone"],
            "qr": identity["qr_payload"],
        }
        login("doctor")
        preview_response = client.post("/provider/identify", json={"method": method, "value": values[method]})
        assert preview_response.status_code == 200, preview_response.text
        preview = preview_response.json()
        access_response = client.post(f"/provider/access/{preview['access_request_id']}/authorize", json={"consent_code": consent})
        assert access_response.status_code == 200, access_response.text
        return access_response.json()
    return _authorize
