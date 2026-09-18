"""Criterion: Doctor can review bounded assistance (labeled deterministic
demo), override it, match facilities by capabilities, and send a referral
that becomes visible in the hospital queue."""

import uuid


def _create_referral(client, reason: str, suffix: str) -> dict:
    response = client.post(
        "/referrals",
        json={
            "patient_id": "demo-patient-001",
            "facility_id": "facility-a",
            "reason": reason,
            "care_requirement": "Cardiology review",
            "urgency": "Routine",
            "symptoms": "tscheck chest discomfort",
            "findings": "Stable vitals",
            "ai_assessment": "Deterministic demo suggestion: cardiology review",
            "doctor_decision": f"tscheck override: sending to cardiology directly ({suffix})",
            "emergency": False,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _find_referral(client, referral_id: str) -> list[dict]:
    response = client.get("/hospital/queue")
    assert response.status_code == 200, response.text
    return [item for item in response.json()["referrals"] if item["id"] == referral_id]


def test_ai_assistance_is_labeled_deterministic_demo(client):
    resp = client.post(
        "/doctor/assessment-assistance",
        json={"symptoms": "tscheck cough and fever", "findings": "mild fever"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["mode"] == "deterministic_demo"
    assert "clinician confirmation required" in body["review"].lower()
    assert len(body["suggested_capabilities"]) > 0


def test_facility_match_returns_capability_ranked_facilities(client):
    resp = client.get("/facilities/match", params={"requirement": "ROUTINE"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert 2 <= len(body["facilities"]) <= 3
    names = [f["name"] for f in body["facilities"]]
    assert "Northstar General Hospital" in names

    resp2 = client.get("/facilities/match", params={"requirement": "EMERGENCY"})
    assert resp2.status_code == 200, resp2.text
    body2 = resp2.json()
    assert all(f["emergency_ready"] for f in body2["facilities"])


def test_doctor_creates_referral_visible_in_hospital_queue(client):
    suffix = uuid.uuid4().hex[:8]
    reason = f"tscheck-referral-{suffix} routine cardiology follow-up"
    referral = _create_referral(client, reason, suffix)
    assert referral["reason"] == reason
    assert referral["facility_name"] == "Harborview Medical Centre"
    assert referral["status"] == "Sent"
    labels = [e["label"] for e in referral["events"]]
    assert labels == ["Created", "Sent", "Received"]

    matching = _find_referral(client, referral["id"])
    assert len(matching) == 1
    assert matching[0]["reason"] == reason
