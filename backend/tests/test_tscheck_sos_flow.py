"""Criterion: SOS records simulated dispatch immediately, optional info does
not block destination choices, and selecting a facility notifies the hospital
and creates an INCOMING EMERGENCY PATIENT queue item (referral)."""

import uuid


def test_sos_immediate_simulated_dispatch(client):
    resp = client.post(
        "/sos", json={"patient_id": "demo-patient-001", "note": ""}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["event"]["dispatch_status"] == "SIMULATED_DISPATCH"
    assert "Emergency action initiated" in body["message"]
    assert len(body["facilities"]) > 0
    assert all(f["emergency_ready"] for f in body["facilities"])


def test_sos_optional_context_then_facility_selection_creates_referral(client):
    suffix = uuid.uuid4().hex[:8]
    resp = client.post(
        "/sos", json={"patient_id": "demo-patient-001", "note": f"tscheck-sos-{suffix}"}
    )
    assert resp.status_code == 200, resp.text
    sos_id = resp.json()["event"]["id"]

    # Optional context update does not block flow
    resp2 = client.post(
        f"/sos/{sos_id}/context", json={"note": f"tscheck-sos-{suffix} extra context"}
    )
    assert resp2.status_code == 200, resp2.text

    # Selecting destination facility
    resp3 = client.post(
        "/sos/select-facility", json={"sos_id": sos_id, "facility_id": "facility-a"}
    )
    assert resp3.status_code == 200, resp3.text
    body3 = resp3.json()
    assert "Hospital notified" in body3["message"]
    assert body3["event"]["status"] == "Hospital Alerted"
    assert body3["event"]["selected_facility_name"] == "Harborview Medical Centre"
    referral_id = body3["event"]["referral_id"]
    assert referral_id

    # Verify referral surfaces in hospital queue as emergency
    resp4 = client.get("/hospital/queue")
    assert resp4.status_code == 200, resp4.text
    matching = [r for r in resp4.json()["referrals"] if r["id"] == referral_id]
    assert len(matching) == 1
    assert matching[0]["emergency"] is True


def test_sos_unknown_event_or_facility_returns_404(client):
    resp = client.post(
        "/sos/select-facility",
        json={"sos_id": "tscheck-nonexistent-sos", "facility_id": "facility-a"},
    )
    assert resp.status_code == 404, resp.text
