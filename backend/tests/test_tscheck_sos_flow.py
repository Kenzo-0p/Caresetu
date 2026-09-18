"""SOS dispatch, optional context, destination, and hospital queue checks."""

import uuid


def _start_sos(client) -> dict:
    suffix = uuid.uuid4().hex[:8]
    response = client.post("/sos", json={"patient_id": "demo-patient-001", "note": f"tscheck-sos-{suffix}"})
    assert response.status_code == 200, response.text
    return response.json()


def _select_facility(client, sos_id: str) -> dict:
    response = client.post("/sos/select-facility", json={"sos_id": sos_id, "facility_id": "facility-a"})
    assert response.status_code == 200, response.text
    return response.json()


def test_sos_immediate_simulated_dispatch(client):
    body = _start_sos(client)
    assert body["event"]["dispatch_status"] == "SIMULATED_DISPATCH"
    assert "Emergency action initiated" in body["message"]
    assert len(body["facilities"]) > 0
    assert all(facility["emergency_ready"] for facility in body["facilities"])


def test_sos_optional_context_is_saved(client):
    body = _start_sos(client)
    response = client.post(f"/sos/{body['event']['id']}/context", json={"note": "extra emergency context"})
    assert response.status_code == 200, response.text
    assert response.json()["note"] == "extra emergency context"


def test_sos_facility_selection_creates_emergency_referral(client):
    body = _start_sos(client)
    selected = _select_facility(client, body["event"]["id"])
    assert "Hospital notified" in selected["message"]
    assert selected["event"]["status"] == "Hospital Alerted"
    assert selected["event"]["selected_facility_name"] == "Harborview Medical Centre"
    referral_id = selected["event"]["referral_id"]
    queue_response = client.get("/hospital/queue")
    assert queue_response.status_code == 200, queue_response.text
    matching = [referral for referral in queue_response.json()["referrals"] if referral["id"] == referral_id]
    assert len(matching) == 1
    assert matching[0]["emergency"] == True


def test_sos_unknown_event_or_facility_returns_404(client):
    response = client.post("/sos/select-facility", json={"sos_id": "tscheck-nonexistent-sos", "facility_id": "facility-a"})
    assert response.status_code == 404, response.text