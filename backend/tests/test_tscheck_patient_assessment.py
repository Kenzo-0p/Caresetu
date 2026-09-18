"""Criterion: Patient can complete/edit health profile and run the bounded
normal symptom assessment one question at a time, ending with the exact
consult-a-doctor guidance."""

import uuid


def test_profile_update_and_bounded_assessment_flow(client):
    suffix = uuid.uuid4().hex[:8]

    # Edit health profile
    profile_payload = {
        "name": "Maya Sharma",
        "age": 29,
        "mobile": "+91 98765 43210",
        "location": "Bengaluru, Karnataka",
        "emergency_contact": "Arjun Sharma · +91 98765 40001",
        "existing_conditions": ["Mild asthma"],
        "allergies": ["Penicillin"],
        "medicines": ["Salbutamol inhaler · as needed"],
        "previous_history": [f"tscheck-assessment-{suffix} visit note"],
    }
    resp = client.put("/patient/profile", json=profile_payload)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["profile_complete"] is True
    assert f"tscheck-assessment-{suffix} visit note" in body["previous_history"]

    # Start bounded assessment
    resp = client.post(
        "/assessment/session",
        json={"symptoms": f"tscheck-{suffix} mild headache and fatigue"},
    )
    assert resp.status_code == 200, resp.text
    session = resp.json()
    session_id = session["session_id"]
    assert session["complete"] is False
    assert session["question_index"] == 0
    assert session["total_questions"] == 3
    assert session["question"]

    # Answer question 1
    resp = client.post(
        "/assessment/message",
        json={"session_id": session_id, "answer": "Started yesterday"},
    )
    assert resp.status_code == 200, resp.text
    step2 = resp.json()
    assert step2["complete"] is False
    assert step2["question_index"] == 1

    # Answer question 2
    resp = client.post(
        "/assessment/message",
        json={"session_id": session_id, "answer": "Unchanged"},
    )
    assert resp.status_code == 200, resp.text
    step3 = resp.json()
    assert step3["complete"] is False
    assert step3["question_index"] == 2

    # Answer question 3 - assessment completes with exact guidance, no diagnosis
    resp = client.post(
        "/assessment/message",
        json={"session_id": session_id, "answer": "No difficulty breathing"},
    )
    assert resp.status_code == 200, resp.text
    final = resp.json()
    assert final["complete"] is True
    assert final["question_index"] == 3
    assert final["guidance"] == "Based on your answers, please consult a doctor."
    assert final["outcome"] == "NORMAL"


def test_assessment_message_unknown_session_returns_404(client):
    resp = client.post(
        "/assessment/message",
        json={"session_id": "tscheck-nonexistent-session", "answer": "x"},
    )
    assert resp.status_code == 404, resp.text
