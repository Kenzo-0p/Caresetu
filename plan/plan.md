# TECHNEXA 2026 Smart Healthcare MVP — Approval Plan

## 1. Purpose

Build a single patient-first healthcare access and referral application that demonstrates the complete path from symptoms to suitable care, referral, and receiving-hospital action.

The product is a live-demo prototype, not a diagnostic tool or a real emergency-response service.

## 2. Roles

- **Patient:** creates a health profile, checks symptoms, uploads medical documents, views referrals, and starts SOS.
- **Doctor / Health Worker:** accesses an authorized patient, reviews history, records findings, reviews assistance, overrides it when needed, and confirms referrals.
- **Hospital Doctor:** receives referrals and emergency alerts, reviews patient information, accepts or redirects cases, marks arrival, and records outcomes.
- **Hospital Admin:** manages incoming referral and emergency queues and operational statuses.

No additional user roles are included in the MVP.

## 3. Required user journeys

### Patient normal-care journey

1. Sign up or sign in.
2. Complete or edit the health profile, including contact details, emergency contact, conditions, allergies, medicines, and history.
3. Select **Check My Symptoms**.
4. Describe symptoms and answer short, plain-language follow-up questions one at a time.
5. Receive care-direction guidance. A normal result advises the patient to consult a doctor and does not present a diagnosis.

### Doctor referral journey

1. Sign in as a doctor or health worker.
2. Find a patient by secure ID, QR-based identifier, or phone number.
3. Request or confirm normal patient authorization before viewing protected information.
4. Review the patient summary, allergies, medicines, history, documents, and prior referrals.
5. Add current symptoms and clinical findings.
6. Review an explicitly labeled **AI-assisted assessment**.
7. Edit or override the assistance; the doctor's confirmed decision is authoritative.
8. View 2–3 suitable facilities with the capabilities that match the care requirement.
9. Select a facility, preview the referral, and confirm/send it.

### Hospital referral journey

1. Sign in as a hospital doctor or admin.
2. See emergency items above normal referrals, with clear urgency labels and recoverable queue state.
3. Open a referral to review patient information, symptoms, findings, reason, care requirements, documents, and timeline.
4. Accept, reject, or redirect the referral.
5. Mark the patient arrived.
6. Record the outcome and update the referral history.

### Emergency SOS journey

1. The patient presses a prominent **SOS Emergency** action.
2. The emergency event and simulated ambulance action are recorded immediately.
3. The interface shows **Emergency action initiated** before any AI loading state.
4. Optional short emergency questions run in parallel and do not block dispatch or continue-state behavior.
5. Available profile/history and optional answers are combined into an emergency summary.
6. Show 2–3 suitable emergency facilities with capability explanations.
7. The patient, guardian, or ambulance workflow selects a destination.
8. The receiving hospital sees a prominent emergency alert, accepts it, marks arrival, and records an outcome.

If the patient cannot answer questions or has no completed profile, the emergency path continues with the available information.

### Medical-document journey

1. Upload a PDF or image report.
2. Preserve the original document and show processing status.
3. Show extracted candidate fields when extraction is sufficiently readable.
4. Mark extracted information **AI extracted — needs verification**.
5. Require review before any extracted information becomes trusted history.
6. If extraction fails or the document is unreadable, show a clear failure state and retain the original without guessing.

## 4. Product and safety rules

- AI assists with wording, question presentation, bounded summaries, and triage support; it must not claim autonomous diagnosis or prescribe medication.
- Deterministic rules control safety-critical routing and urgency behavior.
- AI must never delay or block SOS/ambulance action.
- Doctors retain clinical control and may completely override AI assistance.
- Normal provider access requires patient authorization.
- Emergency break-glass access is visibly distinct, limited to the emergency workflow, and auditable.
- QR codes and lookup links expose secure identifiers, never raw medical information.
- The original medical document remains available even when extraction fails.
- AI-generated and extracted information remain visibly separate from verified clinical information.
- Facility choices must be based on required capabilities and relevant location/case information, not distance alone or an unexplained “best hospital” score.
- The product must show no suitable match rather than inventing availability, beds, doctors, ambulance status, or medical facts.
- Real emergency use must be directed to local emergency services; the prototype must clearly label simulated ambulance behavior.

## 5. Experience direction

- Calm, trustworthy, modern clinical presentation with a light neutral surface and restrained healthcare green/blue accents.
- Red is reserved for SOS and emergency states.
- Patient screens are simple, reassuring, mobile-first, and focused on one clear next action.
- Provider screens are denser, structured, and optimized for tablet/desktop review.
- Use progressive disclosure so urgent and relevant information is visible first while detailed history remains available on demand.
- Every critical workflow needs visible loading, success, empty, and failure states.
- Urgency and status must be communicated with text and icons as well as color.
- The interface should feel like a calm healthcare coordinator, not a generic chatbot or hospital ERP.

Important copy includes:

- “Let’s understand your symptoms. I’ll ask a few questions.”
- “Based on your answers, please consult a doctor.”
- “AI-assisted assessment”
- “Suitable Facilities for This Care Requirement”
- “AI extracted — needs verification”
- “Could not reliably extract information from this document.”
- “INCOMING EMERGENCY PATIENT”

## 6. Referral and status behavior

Use one explicit status timeline for normal and emergency referrals:

**Created → Sent → Received → Accepted / Rejected / Redirected → Arrived → Outcome Updated**

Each transition should show a text label and timestamp. Hospital queues should remain usable from stored data even if live notification delivery is unavailable.

## 7. Integration decisions for the prototype

- Ambulance behavior is simulated and records a clearly labeled dispatch event; no real ambulance provider is required.
- AI and OCR are server-controlled provider adapters. If credentials or providers are unavailable, the application must continue with bounded fallback questions, explicit pending states, and non-AI workflows.
- No AI or OCR output may directly change emergency dispatch state, verified history, or the doctor's confirmed decision.
- The prototype should preserve replaceable boundaries for future managed authentication, relational storage, private document storage, and realtime notifications, but those future production integrations are not required for the demo unless separately approved.

## 8. Demo acceptance scope

The live demo should allow a reviewer to complete, without manual database intervention:

1. Patient profile completion and document upload.
2. Readable-document extraction with verification state, plus an unreadable-document failure state.
3. Normal symptom assessment ending in doctor-visit guidance.
4. Doctor patient lookup, authorization, history review, findings, AI assistance, override, facility matching, and referral confirmation.
5. Hospital referral receipt, acceptance, arrival, and outcome update.
6. SOS immediate simulated dispatch, optional parallel questions, emergency facility selection, hospital emergency alert, arrival, and outcome.

The demonstration must visibly distinguish prototype simulations and unverified assistance from real clinical or emergency services.

## 9. Assumptions selected for approval

- A small fixed, safety-reviewed question set will control the demo assessment; AI may phrase questions but will not invent the clinical decision path.
- Facility matching will use transparent required-capability matching with location as a tie-breaker; exact production weighting is deferred.
- There will be no SOS cancellation flow in this MVP because its behavior is not defined in the source requirements.
- Hospital doctor and hospital admin share the operational queue, while clinical outcome entry remains a hospital-doctor action.
- Demo access will provide working role-specific sign-in paths so all four journeys can be demonstrated quickly; this does not represent a final identity-management policy.

## 10. Decisions worth challenging before implementation

The following source-document decisions remain intentionally open. Approval means accepting the defaults above, or providing alternatives for any item below:

- Should a real AI/OCR provider be connected for the demo, or should the demo use clearly labeled deterministic/mock responses when credentials are unavailable?
- What exact symptom question set and deterministic urgency rules should govern the patient and SOS flows?
- Should emergency hospital access show the complete patient profile as described, or a narrower emergency-only subset?
- Should the default facility tie-breaker prioritize distance, emergency capability, or a fixed demo order after required capabilities match?
- Should the demo use one combined hospital role for speed, or keep separate hospital doctor and hospital admin experiences?

## 11. Explicitly out of scope

- Autonomous diagnosis or prescribing.
- Real-time bed, queue, doctor, or specialist availability.
- Production ambulance dispatch.
- Nationwide facility integration.
- Complex appointments, payments, insurance, teleconsultation, social features, or longitudinal-care automation.
- Advanced analytics, microservices, offline clinical operation, and a full production retention policy.