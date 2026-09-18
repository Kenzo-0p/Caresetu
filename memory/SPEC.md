# CareSetu Smart Healthcare MVP

## Purpose
Patient-first healthcare access and referral demo. It connects patient symptom guidance, doctor-controlled referrals, capability-aware facilities, hospital operations, emergency SOS, and medical document review.

## Roles and access
- Patient: profile, normal symptom check, SOS, documents, referrals.
- Doctor / Health Worker: demo patient lookup after explicit authorization, history review, findings, bounded AI assistance, override, referral.
- Hospital Operations: combined hospital doctor/admin queue with emergency priority, accept, arrived, and outcome actions.
- Authentication is a role-switching demo shell; no production identity provider is connected.

## Data model
Mongo collections: `patient_profiles`, `assessments`, `documents`, `referrals`, `emergency_events`. Facilities are safety-reviewed fixed demo data with capability fields. Original document bytes are retained under `backend/uploads`; extraction is deterministic and unverified until review.

## Key flows
1. Patient edits profile, selects a common symptom card or describes another symptom, answers three follow-ups using one-tap choices or free text, and receives “Based on your answers, please consult a doctor.”
2. Doctor enters `CARE-PT-001`, explicitly confirms authorization, reviews the patient summary, gets “AI-assisted assessment”, can override it, selects a capability-matched facility, and sends a referral.
3. Hospital Operations sees emergency events above routine referrals and can accept, mark arrived, and update outcome.
4. Patient SOS creates and records `SIMULATED_DISPATCH` immediately. Facility selection creates an emergency referral and hospital alert.
5. PDF/JPG/PNG/WEBP upload preserves the original. Normal filenames yield candidate fields marked `AI extracted — needs verification`; filenames containing `unreadable` produce the safe failure state.

## Safety boundaries
No autonomous diagnosis, prescription, real ambulance, beds, availability, or live clinical integration. Deterministic rules control demo routing. AI/OCR outputs remain separate from verified information. Emergency access is visibly labeled and auditable in the demo state.

## Frontend structure
The route page owns only the app shell and role selection. Patient, doctor, and hospital workflows are isolated components using shared typed domain models and shared facility/timeline primitives; hospital queue derivations are memoized.