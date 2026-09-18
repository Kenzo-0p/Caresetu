"""Doctor assistance, facility matching, draft/confirm, and duplicate checks."""

import uuid


def _draft_payload(access, key):
    return {"access_request_id": access["access_request_id"], "facility_id": "facility-a", "reason": "Cardiology review", "care_requirement": "Urgent clinical assessment", "urgency": "URGENT", "symptoms": "Chest discomfort", "findings": "Stable", "vitals": "BP 128/82", "ai_assessment": "Structured support", "doctor_decision": "Doctor confirms cardiology review", "idempotency_key": key}


def test_assistance_requires_authorized_patient(client, login):
    login("doctor")
    response = client.post("/doctor/assessment-assistance", json={"access_request_id": "unknown", "symptoms": "cough", "findings": "", "vitals": ""})
    assert response.status_code == 403, response.text


def test_assistance_and_capability_matching(client, login, authorize_doctor):
    access = authorize_doctor()
    response = client.post("/doctor/assessment-assistance", json={"access_request_id": access["access_request_id"], "symptoms": "chest pain", "findings": "mild", "vitals": "BP 128/82"})
    assert response.status_code == 200, response.text
    assert response.json()["mode"] == "deterministic_fallback"
    assert response.json()["urgency"] == "URGENT"
    facilities = client.get("/facilities/match", params={"requirement": "URGENT"}).json()["facilities"]
    assert 2 <= len(facilities) <= 3
    assert all(item["emergency_ready"] for item in facilities)


def test_referral_draft_confirm_and_duplicate_prevention(client, authorize_doctor):
    access = authorize_doctor()
    key = f"test-{uuid.uuid4()}"
    payload = _draft_payload(access, key)
    first = client.post("/referrals", json=payload)
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "DRAFT"
    duplicate = client.post("/referrals", json=payload)
    assert duplicate.status_code == 200, duplicate.text
    assert duplicate.json()["id"] == first.json()["id"]
    confirmed = client.post(f"/referrals/{first.json()['id']}/confirm")
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "RECEIVED"
    assert [event["label"] for event in confirmed.json()["events"]] == ["DRAFT", "CONFIRMED", "SENT", "RECEIVED"]