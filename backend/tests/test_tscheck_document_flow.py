"""Protected document upload, retention, and provider review checks."""

import io
import uuid


def _upload(client, login, filename):
    login("patient")
    files = {"file": (filename, io.BytesIO(b"%PDF-1.4 synthetic medical report\n%%EOF"), "application/pdf")}
    response = client.post("/documents/upload", files=files)
    assert response.status_code == 200, response.text
    return response.json()


def test_readable_document_is_unverified_until_authorized_provider_review(client, login, authorize_doctor):
    document = _upload(client, login, f"report-{uuid.uuid4().hex[:8]}.pdf")
    assert document["review_status"] == "needs_verification"
    assert document["original_available"] == True
    access = authorize_doctor()
    response = client.post(f"/documents/{document['id']}/review", json={"access_request_id": access["access_request_id"], "decision": "verified"})
    assert response.status_code == 200, response.text
    assert response.json()["review_status"] == "verified"


def test_unreadable_document_is_retained_and_cannot_be_verified(client, login, authorize_doctor):
    document = _upload(client, login, f"unreadable-{uuid.uuid4().hex[:8]}.pdf")
    assert document["review_status"] == "unreadable"
    assert document["extracted_fields"] == []
    access = authorize_doctor()
    response = client.post(f"/documents/{document['id']}/review", json={"access_request_id": access["access_request_id"], "decision": "verified"})
    assert response.status_code == 400, response.text


def test_unauthenticated_document_upload_is_blocked(client):
    files = {"file": ("report.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")}
    response = client.post("/documents/upload", files=files)
    assert response.status_code == 401, response.text