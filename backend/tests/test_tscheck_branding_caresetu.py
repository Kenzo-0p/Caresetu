"""Criterion: All user-visible product branding is renamed from TECHNEXA to
CareSetu. The public API root must identify the app as CareSetu and must not
surface the old TECHNEXA name."""


def test_api_root_identifies_as_caresetu(client):
    resp = client.get("/")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "caresetu" in body.get("message", "").lower(), body
    assert "technexa" not in str(body).lower(), body


def test_demo_state_has_no_technexa_reference(client):
    resp = client.get("/demo/state")
    assert resp.status_code == 200, resp.text
    assert "technexa" not in resp.text.lower(), resp.text
