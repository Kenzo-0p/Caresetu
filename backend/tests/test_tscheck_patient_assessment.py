"""Persistent patient profile and bounded assessment checks."""

import uuid


def _start(client, symptom="mild headache and fatigue"):
    response = client.post("/assessment/session", json={"symptoms": symptom})
    assert response.status_code == 200, response.text
    return response.json()


def _answer(client, session_id, answer):
    response = client.post("/assessment/message", json={"session_id": session_id, "answer": answer})
    assert response.status_code == 200, response.text
    return response.json()


def test_patient_profile_update_persists(client, login):
    login("patient")
    history = f"verified-demo-history-{uuid.uuid4().hex[:8]}"
    payload = {"name": "Maya Sharma", "age": 29, "gender": "Female", "mobile": "9876543210", "location": "Bengaluru, Karnataka", "address": "14 Lake View Road, Bengaluru", "emergency_contact": "Arjun Sharma · +91 98765 40001", "blood_group": "O+", "weight_kg": 58, "existing_conditions": ["Mild asthma"], "allergies": ["Penicillin"], "medicines": ["Salbutamol inhaler · as needed"], "previous_history": [history]}
    response = client.put("/patient/profile", json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["mobile"] == "+919876543210"
    assert history in client.get("/dashboard").json()["profile"]["previous_history"]


def test_routine_assessment_reaches_safe_guidance(client, login):
    login("patient")
    session = _start(client)
    first = _answer(client, session["session_id"], "Today")
    second = _answer(client, session["session_id"], "Unchanged")
    final = _answer(client, session["session_id"], "No")
    assert first["question_index"] == 1
    assert second["question_index"] == 2
    assert final["urgency"] == "ROUTINE"
    assert final["guidance"] == "Based on your answers, please consult a doctor."


def test_emergency_criterion_returns_emergency_guidance(client, login):
    login("patient")
    session = _start(client, "chest discomfort")
    _answer(client, session["session_id"], "Today")
    _answer(client, session["session_id"], "Getting worse")
    final = _answer(client, session["session_id"], "Difficulty breathing")
    assert final["urgency"] == "EMERGENCY"
    assert "emergency" in final["guidance"].lower()


def test_patient_cannot_answer_another_patients_session(client, login):
    login("patient")
    response = client.post("/assessment/message", json={"session_id": "unknown", "answer": "No"})
    assert response.status_code == 404, response.text