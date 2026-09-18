"""Criterion: Doctor normal access requires authorization and provides
protected patient context. Lookup without authorization must be blocked."""


def test_doctor_lookup_without_authorization_is_blocked(client):
    resp = client.post(
        "/doctor/patients/lookup",
        json={"identifier": "TECH-PT-001", "authorization_granted": False},
    )
    assert resp.status_code == 403, resp.text


def test_doctor_lookup_with_authorization_returns_protected_context(client):
    resp = client.post(
        "/doctor/patients/lookup",
        json={"identifier": "TECH-PT-001", "authorization_granted": True},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["authorization_granted"] == True
    patient = body["patient"]
    # The legacy alias TECH-PT-001 is accepted as input for backwards
    # compatibility, but the app now normalizes/returns the CareSetu
    # identifier CARE-PT-001 (no user-visible TECHNEXA branding remains).
    assert patient["secure_id"] == "CARE-PT-001"
    assert patient["name"] == "Maya Sharma"
    assert "Penicillin" in patient["allergies"]
    assert any("Salbutamol" in m for m in patient["medicines"])
    assert len(patient["previous_history"]) > 0
    assert "authorization" in body["access_note"].lower()


def test_doctor_lookup_unknown_identifier_returns_404(client):
    resp = client.post(
        "/doctor/patients/lookup",
        json={"identifier": "TECH-PT-NOPE-999", "authorization_granted": True},
    )
    assert resp.status_code == 404, resp.text
