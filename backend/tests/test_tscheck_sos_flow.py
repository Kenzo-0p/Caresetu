"""Immediate, idempotent SOS and selected-hospital delivery checks."""

import uuid


def _start_sos(client, login, key=None):
    login("patient")
    response = client.post("/sos", json={"note": "Emergency demo", "idempotency_key": key or f"sos-{uuid.uuid4()}"})
    assert response.status_code == 200, response.text
    return response.json()


def test_sos_is_immediate_and_idempotent(client, login):
    key = f"sos-{uuid.uuid4()}"
    first = _start_sos(client, login, key)
    second = client.post("/sos", json={"note": "Repeated tap", "idempotency_key": key})
    assert second.status_code == 200, second.text
    assert second.json()["event"]["id"] == first["event"]["id"]
    assert first["event"]["dispatch_status"] == "SIMULATED_DISPATCH"
    assert "Emergency action initiated" in first["message"]


def test_sos_destination_is_idempotent_and_reaches_hospital(client, login):
    sos = _start_sos(client, login)
    payload = {"sos_id": sos["event"]["id"], "facility_id": "facility-a"}
    first = client.post("/sos/select-facility", json=payload)
    second = client.post("/sos/select-facility", json=payload)
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert second.json()["event"]["referral_id"] == first.json()["event"]["referral_id"]
    login("hospital_doctor")
    queue = client.get("/hospital/queue")
    assert queue.status_code == 200, queue.text
    assert any(item["id"] == first.json()["event"]["referral_id"] for item in queue.json()["referrals"])