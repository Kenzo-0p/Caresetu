"""Criterion: Medical document flow preserves originals and visibly separates
unverified extraction from trusted history; unreadable filenames get the safe
failure state and remain retained."""

import io
import uuid


def _pdf_bytes() -> bytes:
    return b"%PDF-1.4 tscheck demo document content for extraction test\n%%EOF"


def test_readable_document_upload_needs_verification_then_verify(client):
    suffix = uuid.uuid4().hex[:8]
    filename = f"tscheck-report-{suffix}.pdf"
    files = {"file": (filename, io.BytesIO(_pdf_bytes()), "application/pdf")}
    resp = client.post("/documents/upload", files=files)
    assert resp.status_code == 200, resp.text
    doc = resp.json()
    assert doc["filename"] == filename
    assert doc["original_available"] == True
    assert doc["review_status"] == "needs_verification"
    assert len(doc["extracted_fields"]) > 0

    # Verify it moves to verified state
    resp2 = client.post(f"/documents/{doc['id']}/verify")
    assert resp2.status_code == 200, resp2.text
    verified = resp2.json()
    assert verified["review_status"] == "verified"


def test_unreadable_document_upload_safe_failure_state(client):
    suffix = uuid.uuid4().hex[:8]
    filename = f"tscheck-unreadable-{suffix}.png"
    files = {"file": (filename, io.BytesIO(_pdf_bytes()), "image/png")}
    resp = client.post("/documents/upload", files=files)
    assert resp.status_code == 200, resp.text
    doc = resp.json()
    assert doc["review_status"] == "unreadable"
    assert doc["extracted_fields"] == []
    assert doc["original_available"] == True

    # Unreadable documents cannot be verified (400)
    resp2 = client.post(f"/documents/{doc['id']}/verify")
    assert resp2.status_code == 400, resp2.text


def test_unsupported_content_type_rejected(client):
    suffix = uuid.uuid4().hex[:8]
    filename = f"tscheck-badtype-{suffix}.txt"
    files = {"file": (filename, io.BytesIO(b"plain text"), "text/plain")}
    resp = client.post("/documents/upload", files=files)
    assert resp.status_code == 415, resp.text
