# CareSetu MVP Audit Checklist

## Baseline preserved
- [x] Patient profile persistence in Mongo
- [x] Structured three-question self-assessment with deterministic safe guidance
- [x] Capability-labeled synthetic facilities
- [x] Doctor assistance visibly separated from doctor decision
- [x] Hospital emergency-priority queue and basic status history
- [x] SOS dispatch recorded before destination selection
- [x] Original document retention with unverified/readability states
- [x] Public ingress, frontend typecheck, backend suite, and browser flows previously healthy

## Confirmed critical gaps
- [ ] Server-side login, cookie sessions, and role authorization
- [ ] Multiple persistent patients linked to authenticated users
- [ ] Internal patient ID separated from public Patient Code
- [ ] Unique indexed Patient Code generation with collision retry
- [ ] Normalized unique phone storage and exact phone lookup
- [ ] Opaque expiring QR tokens, QR display, camera/image/paste decoding, safe validation
- [ ] Identification preview separated from protected medical access
- [ ] One-time patient consent authorization and access-request audit
- [ ] Controlled break-glass access with actor/reason/emergency audit
- [ ] Role-scoped dashboard data and document access
- [ ] Full persistent referral state machine with actor events and duplicate prevention
- [ ] Idempotent SOS destination selection
- [ ] Polling fallback for hospital/referral synchronization
- [ ] Deterministic seed/reset mechanism and working demo accounts

## Important hardening
- [ ] Input validation for Patient Code, phone, QR, consent, and status reasons
- [ ] Lookup rate limiting and non-enumerating errors
- [ ] Secure session/logout cache clearing
- [ ] Protected document verification/rejection by authorized providers
- [ ] Database indexes for patient code, normalized phone, session expiry, QR token, access/audit, and referrals
- [ ] Unit/API/E2E coverage for identity, auth, consent, QR, referral transitions, duplicates, SOS, and documents
- [ ] Production build, deployment readiness check, security audit, and clean demo rehearsal

## Explicit prototype boundaries
- [x] AI assessment remains a deterministic server adapter with safe fallback behavior
- [x] OCR remains a clearly labeled deterministic adapter; originals are retained
- [x] Ambulance dispatch remains SIMULATED and cannot be delayed by AI
- [x] No real-time capacity, beds, doctors, prescriptions, or autonomous diagnosis claims