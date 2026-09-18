export type Role = "patient" | "doctor" | "health_worker" | "hospital_doctor" | "hospital_admin";
export type ReviewStatus = "processing" | "needs_verification" | "unreadable" | "verified" | "rejected";
export type ReferralStatus = "DRAFT" | "CONFIRMED" | "SENT" | "RECEIVED" | "ACCEPTED" | "ARRIVED" | "COMPLETED" | "REJECTED" | "REDIRECTED" | "CANCELLED";

export interface SessionUser {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  patient_code?: string | null;
  facility_id?: string | null;
}

export interface LoginRequest { email: string; password: string }

export interface EventItem {
  label: string;
  timestamp: string;
  detail?: string | null;
  actor_user_id?: string | null;
  actor_role?: string | null;
}

export interface Profile {
  patient_code: string;
  name: string;
  age: number;
  gender: string;
  mobile: string;
  location: string;
  address: string;
  emergency_contact: string;
  blood_group?: string | null;
  weight_kg?: number | null;
  existing_conditions: string[];
  allergies: string[];
  medicines: string[];
  previous_history: string[];
  profile_complete: boolean;
}

export interface ProfileUpdate {
  name: string;
  age: number;
  gender: string;
  mobile: string;
  location: string;
  address: string;
  emergency_contact: string;
  blood_group?: string | null;
  weight_kg?: number | null;
  existing_conditions: string[];
  allergies: string[];
  medicines: string[];
  previous_history: string[];
}

export interface Facility {
  id: string;
  name: string;
  location: string;
  distance: string;
  capabilities: string[];
  match_reason: string;
  emergency_ready: boolean;
}

export interface Referral {
  id: string;
  idempotency_key: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  patient_summary: {
    age: number;
    gender: string;
    blood_group?: string | null;
    existing_conditions: string[];
    allergies: string[];
    medicines: string[];
  };
  access_request_id?: string | null;
  referring_user_id?: string | null;
  referring_provider_name: string;
  facility_id: string;
  facility_name: string;
  reason: string;
  care_requirement: string;
  urgency: string;
  symptoms: string;
  findings: string;
  vitals: string;
  ai_assessment: string;
  doctor_decision: string;
  status: ReferralStatus;
  emergency: boolean;
  created_at: string;
  updated_at: string;
  events: EventItem[];
  outcome?: string | null;
}

export interface ReferralCreate {
  access_request_id: string;
  facility_id: string;
  reason: string;
  care_requirement: string;
  urgency: string;
  symptoms: string;
  findings: string;
  vitals: string;
  ai_assessment: string;
  doctor_decision: string;
  idempotency_key: string;
}

export interface ReferralActionRequest {
  status: "ACCEPTED" | "REJECTED" | "REDIRECTED" | "ARRIVED" | "COMPLETED" | "CANCELLED";
  outcome?: string;
  reason?: string;
}

export interface EmergencyEvent {
  id: string;
  idempotency_key: string;
  patient_id: string;
  patient_code: string;
  patient_name: string;
  status: string;
  dispatch_status: string;
  note: string;
  selected_facility_id?: string | null;
  selected_facility_name?: string | null;
  referral_id?: string | null;
  created_at: string;
  updated_at: string;
  audit_note: string;
}

export interface DocumentItem {
  id: string;
  patient_id: string;
  filename: string;
  storage_name: string;
  content_type: string;
  size_bytes: number;
  review_status: ReviewStatus;
  extracted_fields: string[];
  original_available: boolean;
  extraction_mode: string;
  review_actor_user_id?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface DashboardState {
  profile?: Profile | null;
  facilities: Facility[];
  referrals: Referral[];
  emergencies: EmergencyEvent[];
  documents: DocumentItem[];
}

export interface AssessmentStart {
  session_id: string;
  question: string | null;
  question_index: number;
  total_questions: number;
  complete: boolean;
  urgency: "ROUTINE" | "URGENT" | "EMERGENCY";
}

export interface AssessmentAnswer extends AssessmentStart {
  outcome?: string | null;
  guidance?: string | null;
}

export interface DoctorAssessment {
  mode: "deterministic_fallback";
  urgency: string;
  care_requirement: string;
  summary: string;
  suggested_capabilities: string[];
  review: string;
}

export interface SOSResponse { event: EmergencyEvent; facilities: Facility[]; message: string }
export interface SOSCreate { note: string; idempotency_key: string }

export interface PatientIdentity {
  patient_code: string;
  normalized_phone: string;
  qr_payload: string;
  qr_svg_data_url: string;
  qr_expires_at: string;
}

export interface ConsentCodeResponse { consent_code: string; expires_at: string; instruction: string }
export interface IdentityLookupRequest { method: "patient_code" | "phone" | "qr"; value: string }

export interface IdentityPreview {
  access_request_id: string;
  patient_code: string;
  name: string;
  age: number;
  gender: string;
  masked_phone: string;
  method: string;
  expires_at: string;
  authorization_required: boolean;
}

export interface AuthorizedPatientAccess {
  access_request_id: string;
  patient: Profile;
  authorization_granted: boolean;
  expires_at: string;
  access_note: string;
  documents: DocumentItem[];
  prior_referrals: Referral[];
}

export const EMPTY_STATE: DashboardState = {
  profile: null,
  facilities: [],
  referrals: [],
  emergencies: [],
  documents: [],
};