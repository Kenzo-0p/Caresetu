"""Public branding and authentication boundary checks."""


def test_api_root_identifies_caresetu_mvp(client):
    response = client.get("/")
    assert response.status_code == 200, response.text
    assert "caresetu" in response.json()["message"].lower()
    assert "technexa" not in response.text.lower()


def test_dashboard_requires_authentication(client):
    response = client.get("/dashboard")
    assert response.status_code == 401, response.text


def test_each_seeded_role_receives_server_identity(client, login):
    for role in ["patient", "doctor", "worker", "hospital_doctor", "hospital_admin"]:
        session = login(role)
        me = client.get("/auth/me")
        assert me.status_code == 200, me.text
        assert me.json()["id"] == session["id"]


def test_logout_revokes_session(client, login):
    login("patient")
    response = client.post("/auth/logout")
    assert response.status_code == 204, response.text
    assert client.get("/auth/me").status_code == 401