export type Role = "patient" | "doctor" | "hospital";
export type ReviewStatus = "processing" | "needs_verification" | "unreadable" | "verified";

export interface EventItem {
  label: string;
  timestamp: string;
  detail?: string | null;
}

export interface Profile {
  id: string;
  secure_id: string;
  name: string;
  age: number;
  gender: string;
  mobile: string;
  location: string;
  address: string;
  emergency_contact: string;
  blood_group: string;
  existing_conditions: string[];
  allergies: string[];
  medicines: string[];
  previous_history: string[];
  profile_complete: boolean;
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
  patient_id: string;
  patient_name: string;
  facility_id: string;
  facility_name: string;
  reason: string;
  care_requirement: string;
  urgency: string;
  symptoms: string;
  findings: string;
  ai_assessment: string;
  doctor_decision: string;
  status: string;
  emergency: boolean;
  created_at: string;
  events: EventItem[];
  outcome?: string | null;
}

export interface EmergencyEvent {
  id: string;
  patient_id: string;
  patient_name: string;
  status: string;
  dispatch_status: string;
  note: string;
  selected_facility_id?: string | null;
  selected_facility_name?: string | null;
  referral_id?: string | null;
  created_at: string;
  audit_note: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  review_status: ReviewStatus;
  extracted_fields: string[];
  original_available: boolean;
  created_at: string;
}

export interface DemoState {
  profile: Profile;
  facilities: Facility[];
  referrals: Referral[];
  emergencies: EmergencyEvent[];
  documents: DocumentItem[];
}

export interface AssessmentStart {
  session_id: string;
  question: string;
  question_index: number;
  total_questions: number;
  complete: boolean;
}

export interface AssessmentAnswer {
  session_id: string;
  question?: string | null;
  question_index: number;
  total_questions: number;
  complete: boolean;
  outcome?: string | null;
  guidance?: string | null;
}

export interface DoctorAssessment {
  mode: string;
  urgency: string;
  care_requirement: string;
  summary: string;
  suggested_capabilities: string[];
  review: string;
}

export interface SOSResponse {
  event: EmergencyEvent;
  facilities: Facility[];
  message: string;
}

export const EMPTY_PROFILE: Profile = {
  id: "demo-patient-001",
  secure_id: "CARE-PT-001",
  name: "Maya Sharma",
  age: 29,
  gender: "Female",
  mobile: "+91 98765 43210",
  location: "Bengaluru, Karnataka",
  address: "14 Lake View Road, Bengaluru",
  emergency_contact: "Arjun Sharma · +91 98765 40001",
  blood_group: "O+",
  existing_conditions: ["Mild asthma"],
  allergies: ["Penicillin"],
  medicines: ["Salbutamol inhaler · as needed"],
  previous_history: ["Asthma review · Jan 2026"],
  profile_complete: true,
};

export const EMPTY_STATE: DemoState = {
  profile: EMPTY_PROFILE,
  facilities: [],
  referrals: [],
  emergencies: [],
  documents: [],
};