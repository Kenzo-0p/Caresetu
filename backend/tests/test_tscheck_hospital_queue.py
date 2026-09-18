"""Hospital queue authorization and referral state-machine checks."""

import uuid


def _confirmed_referral(client, login, authorize_doctor):
    access = authorize_doctor()
    payload = {"access_request_id": access["access_request_id"], "facility_id": "facility-a", "reason": "Routine review", "care_requirement": "Primary care review", "urgency": "ROUTINE", "symptoms": "Fatigue", "findings": "Stable", "vitals": "", "ai_assessment": "Routine", "doctor_decision": "Doctor confirms", "idempotency_key": f"test-{uuid.uuid4()}"}
    draft = client.post("/referrals", json=payload).json()
    confirmed = client.post(f"/referrals/{draft['id']}/confirm").json()
    login("hospital_doctor")
    return confirmed


def test_hospital_lifecycle_received_to_completed(client, login, authorize_doctor):
    referral = _confirmed_referral(client, login, authorize_doctor)
    accepted = client.post(f"/referrals/{referral['id']}/status", json={"status": "ACCEPTED"})
    assert accepted.status_code == 200, accepted.text
    arrived = client.post(f"/referrals/{referral['id']}/status", json={"status": "ARRIVED"})
    assert arrived.status_code == 200, arrived.text
    completed = client.post(f"/referrals/{referral['id']}/status", json={"status": "COMPLETED", "outcome": "Reviewed and discharged"})
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "COMPLETED"
    assert [event["label"] for event in completed.json()["events"]][-3:] == ["ACCEPTED", "ARRIVED", "COMPLETED"]


def test_invalid_transition_is_rejected(client, login, authorize_doctor):
    referral = _confirmed_referral(client, login, authorize_doctor)
    response = client.post(f"/referrals/{referral['id']}/status", json={"status": "ARRIVED"})
    assert response.status_code == 409, response.text


def test_reject_requires_reason(client, login, authorize_doctor):
    referral = _confirmed_referral(client, login, authorize_doctor)
    missing = client.post(f"/referrals/{referral['id']}/status", json={"status": "REJECTED"})
    assert missing.status_code == 422, missing.text
    valid = client.post(f"/referrals/{referral['id']}/status", json={"status": "REJECTED", "reason": "Capability unavailable for this case"})
    assert valid.status_code == 200, valid.text


def test_hospital_admin_cannot_record_clinical_outcome(client, login, authorize_doctor):
    referral = _confirmed_referral(client, login, authorize_doctor)
    client.post(f"/referrals/{referral['id']}/status", json={"status": "ACCEPTED"})
    client.post(f"/referrals/{referral['id']}/status", json={"status": "ARRIVED"})
    login("hospital_admin")
    response = client.post(f"/referrals/{referral['id']}/status", json={"status": "COMPLETED", "outcome": "Attempt"})
    assert response.status_code == 403, response.text