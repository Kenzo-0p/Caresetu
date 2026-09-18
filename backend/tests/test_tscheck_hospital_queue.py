"""Criterion: Hospital combined operations queue prioritizes emergency items
and supports valid lifecycle actions (accept, arrived, outcome; reject/
redirect from Sent) with a visible event timeline."""

import uuid


def _create_referral(client, suffix: str) -> dict:
    resp = client.post(
        "/referrals",
        json={
            "patient_id": "demo-patient-001",
            "facility_id": "facility-b",
            "reason": f"tscheck-queue-{suffix} routine review",
            "care_requirement": "Primary care review",
            "urgency": "Routine",
            "doctor_decision": f"tscheck-queue-{suffix} decision",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_referral_lifecycle_accept_arrive_outcome(client):
    suffix = uuid.uuid4().hex[:8]
    referral = _create_referral(client, suffix)
    rid = referral["id"]

    # Accept
    resp = client.post(f"/referrals/{rid}/status", json={"status": "Accepted"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "Accepted"

    # Arrived
    resp = client.post(f"/referrals/{rid}/status", json={"status": "Arrived"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "Arrived"

    # Outcome
    resp = client.post(
        f"/referrals/{rid}/status",
        json={"status": "Outcome Updated", "outcome": "Treated and discharged"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "Outcome Updated"
    assert body["outcome"] == "Treated and discharged"
    labels = [e["label"] for e in body["events"]]
    assert labels == ["Created", "Sent", "Received", "Accepted", "Arrived", "Outcome Updated"]


def test_referral_can_be_rejected_or_redirected_from_sent(client):
    suffix = uuid.uuid4().hex[:8]
    referral = _create_referral(client, suffix)
    resp = client.post(
        f"/referrals/{referral['id']}/status", json={"status": "Rejected"}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "Rejected"


def test_invalid_transition_is_rejected(client):
    suffix = uuid.uuid4().hex[:8]
    referral = _create_referral(client, suffix)
    # Cannot jump straight to Arrived from Sent
    resp = client.post(f"/referrals/{referral['id']}/status", json={"status": "Arrived"})
    assert resp.status_code == 409, resp.text


def test_hospital_queue_lists_emergency_events(client):
    resp = client.post("/sos", json={"patient_id": "demo-patient-001", "note": "tscheck sos queue check"})
    assert resp.status_code == 200, resp.text
    sos = resp.json()
    event_id = sos["event"]["id"]

    resp2 = client.get("/hospital/queue")
    assert resp2.status_code == 200, resp2.text
    queue = resp2.json()
    matching = [e for e in queue["emergencies"] if e["id"] == event_id]
    assert len(matching) == 1
    assert matching[0]["dispatch_status"] == "SIMULATED_DISPATCH"
