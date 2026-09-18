"""Patient Code, phone and QR must identify one record without exposing history."""


def _patient_identity_and_consent(client, login):
    login("patient")
    identity_response = client.get("/patient/identity")
    assert identity_response.status_code == 200, identity_response.text
    consent_response = client.post("/patient/identity/consent-code")
    assert consent_response.status_code == 200, consent_response.text
    return identity_response.json(), consent_response.json()["consent_code"]


def test_all_three_identity_methods_resolve_same_patient_preview(client, login):
    identity, _ = _patient_identity_and_consent(client, login)
    login("doctor")
    values = {"patient_code": identity["patient_code"], "phone": "98765 43210", "qr": identity["qr_payload"]}
    previews = []
    for method, value in values.items():
        response = client.post("/provider/identify", json={"method": method, "value": value})
        assert response.status_code == 200, response.text
        preview = response.json()
        assert "allergies" not in preview
        assert preview["authorization_required"] == True
        previews.append(preview)
    assert {item["patient_code"] for item in previews} == {"PAT-7K4M92"}
    assert {item["name"] for item in previews} == {"Maya Sharma"}


def test_one_time_consent_unlocks_full_profile(client, login):
    identity, consent = _patient_identity_and_consent(client, login)
    login("doctor")
    preview = client.post("/provider/identify", json={"method": "patient_code", "value": identity["patient_code"]}).json()
    response = client.post(f"/provider/access/{preview['access_request_id']}/authorize", json={"consent_code": consent})
    assert response.status_code == 200, response.text
    access = response.json()
    assert access["authorization_granted"] == True
    assert "Penicillin" in access["patient"]["allergies"]
    assert access["patient"]["patient_code"] == identity["patient_code"]


def test_consent_code_cannot_be_replayed(client, login):
    identity, consent = _patient_identity_and_consent(client, login)
    login("doctor")
    first = client.post("/provider/identify", json={"method": "patient_code", "value": identity["patient_code"]}).json()
    assert client.post(f"/provider/access/{first['access_request_id']}/authorize", json={"consent_code": consent}).status_code == 200
    second = client.post("/provider/identify", json={"method": "patient_code", "value": identity["patient_code"]}).json()
    assert client.post(f"/provider/access/{second['access_request_id']}/authorize", json={"consent_code": consent}).status_code == 403


def test_manipulated_qr_is_rejected_safely(client, login):
    login("doctor")
    response = client.post("/provider/identify", json={"method": "qr", "value": "caresetu://patient/manipulated"})
    assert response.status_code == 422, response.text


def test_patient_code_format_is_validated(client, login):
    login("doctor")
    response = client.post("/provider/identify", json={"method": "patient_code", "value": "CARE-PT-001"})
    assert response.status_code == 422, response.text


def test_patient_cannot_use_provider_identity_route(client, login):
    login("patient")
    response = client.post("/provider/identify", json={"method": "patient_code", "value": "PAT-7K4M92"})
    assert response.status_code == 403, response.text