"""Patient profile and bounded assessment API checks."""

import uuid


def _start_assessment(client, symptom: str = "mild headache and fatigue") -> dict:
    response = client.post("/assessment/session", json={"symptoms": symptom})
    assert response.status_code == 200, response.text
    return response.json()


def _answer(client, session_id: str, answer: str) -> dict:
    response = client.post("/assessment/message", json={"session_id": session_id, "answer": answer})
    assert response.status_code == 200, response.text
    return response.json()


def test_profile_update_persists_health_history(client):
    suffix = uuid.uuid4().hex[:8]
    history = f"tscheck-assessment-{suffix} visit note"
    payload = {
        "name": "Maya Sharma",
        "age": 29,
        "mobile": "+91 98765 43210",
        "location": "Bengaluru, Karnataka",
        "emergency_contact": "Arjun Sharma · +91 98765 40001",
        "existing_conditions": ["Mild asthma"],
        "allergies": ["Penicillin"],
        "medicines": ["Salbutamol inhaler · as needed"],
        "previous_history": [history],
    }
    response = client.put("/patient/profile", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["profile_complete"] == True
    assert history in body["previous_history"]


def test_assessment_session_starts_at_first_question(client):
    session = _start_assessment(client)
    assert session["complete"] == False
    assert session["question_index"] == 0
    assert session["total_questions"] == 3
    assert session["question"]


def test_assessment_advances_and_returns_exact_guidance(client):
    session = _start_assessment(client)
    session_id = session["session_id"]
    second = _answer(client, session_id, "Started yesterday")
    assert second["complete"] == False
    assert second["question_index"] == 1
    third = _answer(client, session_id, "Unchanged")
    assert third["complete"] == False
    assert third["question_index"] == 2
    final = _answer(client, session_id, "No difficulty breathing")
    assert final["complete"] == True
    assert final["question_index"] == 3
    assert final["guidance"] == "Based on your answers, please consult a doctor."
    assert final["outcome"] == "NORMAL"


def test_assessment_message_unknown_session_returns_404(client):
    response = client.post("/assessment/message", json={"session_id": "tscheck-nonexistent-session", "answer": "x"})
    assert response.status_code == 404, response.text