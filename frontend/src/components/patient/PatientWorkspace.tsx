import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRight, CheckCircle2, Copy, FileText, HeartPulse, KeyRound, QrCode, RefreshCw, ShieldCheck, Siren, Smartphone, Upload } from "lucide-react";
import { toast } from "sonner";

import { SectionHeading, statusTone, Timeline } from "@/components/CareComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost, apiPut, apiUpload } from "@/lib/api";
import type {
  AssessmentAnswer,
  AssessmentStart,
  ConsentCodeResponse,
  DashboardState,
  DocumentItem,
  EmergencyEvent,
  Profile,
  ProfileUpdate,
  Referral,
  SOSResponse,
  PatientIdentity,
} from "@/types/domain";

const INITIAL_CHOICES = ["Headache", "Fever or chills", "Stomach discomfort", "Tired or weak"];
const FOLLOW_UP_CHOICES = [
  ["Today", "Yesterday", "2–7 days ago", "More than a week"],
  ["Getting better", "Unchanged", "Getting worse", "Comes and goes"],
  ["No", "Difficulty breathing", "Feeling faint", "Both"],
];

function choicesFor(assessment: AssessmentStart | null) {
  if (!assessment) return INITIAL_CHOICES;
  return FOLLOW_UP_CHOICES[assessment.question_index] ?? FOLLOW_UP_CHOICES[2];
}

function PatientHero({ profile }: { profile: Profile }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-teal-100 bg-white p-6 shadow-[0_20px_55px_-30px_rgba(15,118,110,.3)] sm:p-8" data-testid="patient-welcome-card">
      <div className="absolute -right-12 -top-16 size-56 rounded-full bg-teal-50" />
      <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-700">PATIENT SPACE · DEMO</p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Good morning, {profile.name.split(" ")[0]}.</h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-500">A calm place to understand what you need next — with your information in your hands.</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="grid size-10 place-items-center rounded-full bg-teal-100 text-teal-700"><ShieldCheck size={20} /></div>
          <div><p className="text-sm font-semibold text-slate-800">Profile ready</p><p className="text-xs text-slate-500">Private patient record · {profile.patient_code}</p></div>
        </div>
      </div>
    </section>
  );
}

function PrimaryActions({ onAssessment, onSos, sosPending }: { onAssessment: () => void; onSos: () => void; sosPending: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-[1.15fr_.85fr]">
      <button type="button" onClick={onAssessment} className="group relative overflow-hidden rounded-[24px] bg-[#0d9488] p-6 text-left text-white shadow-[0_18px_42px_-20px_rgba(13,148,136,.65)] transition-transform duration-150 hover:-translate-y-0.5" data-testid="check-symptoms-button">
        <Activity className="absolute -right-4 -top-4 size-32 opacity-10" />
        <div className="relative"><div className="mb-6 grid size-11 place-items-center rounded-2xl bg-white/15"><HeartPulse size={24} /></div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal-100">NORMAL CARE</p><h2 className="mt-2 font-heading text-2xl font-semibold">Check My Symptoms</h2><p className="mt-2 max-w-sm text-sm leading-relaxed text-teal-50">A few focused questions can help you understand your next step. No diagnosis, just guidance.</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">Start a guided check <ArrowRight size={16} /></span></div>
      </button>
      <button type="button" onClick={onSos} disabled={sosPending} className="group relative overflow-hidden rounded-[24px] border-2 border-red-200 bg-red-50 p-6 text-left text-red-900 transition-transform duration-150 hover:-translate-y-0.5 disabled:opacity-70" data-testid="sos-emergency-button">
        <Siren className="absolute -right-3 -top-3 size-32 text-red-200" />
        <div className="relative"><div className="mb-6 grid size-11 place-items-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-200"><Siren size={24} /></div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-700">EMERGENCY FAST LANE</p><h2 className="mt-2 font-heading text-2xl font-semibold">SOS Emergency</h2><p className="mt-2 max-w-sm text-sm leading-relaxed text-red-800/70">The simulated ambulance action starts immediately. Optional questions never delay it.</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-red-700">{sosPending ? "Starting emergency action…" : "Start emergency action"} <ArrowRight size={16} /></span></div>
      </button>
    </div>
  );
}

function EmergencyPanel({ response, selectedFacility, onSelect, onNotify, notifying }: { response: SOSResponse; selectedFacility: string; onSelect: (id: string) => void; onNotify: () => void; notifying: boolean }) {
  const notified = Boolean(response.event.selected_facility_id);
  return (
    <section className="rounded-[24px] border border-red-300 bg-[#450a0a] p-5 text-white shadow-[0_20px_50px_-25px_rgba(127,29,29,.8)]" data-testid="sos-active-panel">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-red-500"><Siren size={20} /></div><div><p className="font-mono text-[10px] font-bold tracking-[0.18em] text-red-200">EMERGENCY ACTION INITIATED</p><h2 className="mt-1 font-heading text-xl font-semibold">Simulated ambulance dispatch is active</h2><p className="mt-1 text-sm text-red-100/75">{response.message} This is a demo simulation — call local emergency services for a real emergency.</p></div></div>
        <Badge className="w-fit border-red-400 bg-red-500/20 text-red-100" data-testid="sos-dispatch-status">{response.event.dispatch_status}</Badge>
      </div>
      {notified ? <HospitalNotified event={response.event} /> : <EmergencyDestination response={response} selectedFacility={selectedFacility} onSelect={onSelect} onNotify={onNotify} notifying={notifying} />}
    </section>
  );
}

function HospitalNotified({ event }: { event: EmergencyEvent }) {
  return <div className="mt-5 flex items-center gap-3 rounded-2xl border border-red-200/20 bg-white/10 p-4" data-testid="sos-hospital-notified-state"><CheckCircle2 className="text-red-200" /><div><p className="font-semibold">Hospital notified</p><p className="text-sm text-red-100/70">{event.selected_facility_name} · emergency referral {event.referral_id}</p></div></div>;
}

function EmergencyDestination({ response, selectedFacility, onSelect, onNotify, notifying }: { response: SOSResponse; selectedFacility: string; onSelect: (id: string) => void; onNotify: () => void; notifying: boolean }) {
  return (
    <div className="mt-5 border-t border-red-300/20 pt-5">
      <p className="text-sm font-semibold text-red-50">Choose a receiving destination</p>
      <p className="mt-1 text-xs text-red-100/70">Emergency-only summary is ready. Facility capabilities are shown clearly.</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {response.facilities.map((facility) => {
          const selected = selectedFacility === facility.id;
          return <button type="button" key={facility.id} onClick={() => onSelect(facility.id)} className={`rounded-2xl border p-3 text-left transition-colors duration-150 ${selected ? "border-white bg-white/15" : "border-red-200/30 bg-red-950/30 hover:border-red-200/60"}`} data-testid={`sos-facility-${facility.id}-option`}><div className="flex items-center justify-between"><span className="font-semibold">{facility.name}</span>{selected && <CheckCircle2 size={18} />}</div><p className="mt-1 text-xs text-red-100/70">{facility.location} · {facility.distance}</p><div className="mt-2 flex flex-wrap gap-1">{facility.capabilities.slice(0, 3).map((capability) => <span key={capability} className="rounded-full bg-white/10 px-2 py-1 text-[10px]">{capability}</span>)}</div></button>;
        })}
      </div>
      <Button disabled={!selectedFacility || notifying} onClick={onNotify} className="mt-4 bg-white text-red-800 hover:bg-red-50" data-testid="sos-select-destination-button">{notifying ? "Notifying hospital…" : "Select destination & notify hospital"}</Button>
    </div>
  );
}

function QuickChoicePanel({ assessment, choices, onChoose, onOther }: { assessment: AssessmentStart | null; choices: string[]; onChoose: (choice: string) => void; onOther: () => void }) {
  return (
    <section className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-3xl rounded-2xl border border-teal-200 bg-white/95 p-3 shadow-[0_18px_55px_-18px_rgba(15,118,110,.45)] backdrop-blur-xl sm:bottom-5 sm:p-4" data-testid="symptom-quick-choice-panel">
      <div className="flex items-center justify-between gap-3"><div><p className="font-heading text-sm font-semibold text-slate-900">{assessment ? "Choose one answer" : "What best describes how you feel?"}</p><p className="text-xs text-slate-500">One tap moves you forward. Choose Other if none fit.</p></div><Badge className="shrink-0 border-teal-200 bg-teal-50 text-teal-700">Quick choices</Badge></div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {choices.map((choice) => <button type="button" key={choice} onClick={() => onChoose(choice)} className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" data-testid={`symptom-choice-${choice.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{choice}</button>)}
        <button type="button" onClick={onOther} className="min-h-12 rounded-xl border border-dashed border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 transition-colors duration-150 hover:border-teal-500 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" data-testid="symptom-choice-other">{assessment ? "Other" : "Describe something else"}</button>
      </div>
    </section>
  );
}

function SymptomAssessment({ onClose }: { onClose: () => void }) {
  const [assessment, setAssessment] = useState<AssessmentStart | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<AssessmentAnswer | null>(null);
  const assessmentIdRef = useRef<string | null>(null);
  const quickSymptomRef = useRef<string | null>(null);
  const start = useMutation({ mutationFn: () => apiPost<AssessmentStart>("/assessment/session", { symptoms: quickSymptomRef.current || answer || "I have been feeling tired and unsettled." }), onSuccess: (next) => { quickSymptomRef.current = null; assessmentIdRef.current = next.session_id; setAssessment(next); setResult(null); setAnswer(""); } });
  const respond = useMutation({ mutationFn: (value: string) => apiPost<AssessmentAnswer>("/assessment/message", { session_id: assessmentIdRef.current, answer: value }), onMutate: () => setAssessment(null), onSuccess: (next) => { if (next.complete) assessmentIdRef.current = null; setAssessment(next.complete ? null : { ...next, question: next.question || "" }); setResult(next); setAnswer(""); } });
  const pending = start.isPending || respond.isPending;

  const choose = (choice: string) => {
    if (assessment) { respond.mutate(choice); return; }
    quickSymptomRef.current = choice;
    start.mutate();
  };
  const focusOther = () => {
    const selector = assessment ? '[data-testid="symptom-answer-input"]' : '[data-testid="symptom-description-input"]';
    const target = document.querySelector<HTMLElement>(selector);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus();
  };

  let body;
  if (pending) body = <div className="rounded-2xl bg-slate-50 p-5" data-testid="assessment-saving-state"><div className="h-4 w-32 animate-pulse rounded bg-slate-200" /><div className="mt-4 h-12 animate-pulse rounded-xl bg-slate-200" /></div>;
  else if (result?.complete) body = <AssessmentResult onClose={onClose} />;
  else if (!assessment) body = <AssessmentStartForm answer={answer} setAnswer={setAnswer} onStart={() => start.mutate()} />;
  else body = <AssessmentQuestion assessment={assessment} answer={answer} setAnswer={setAnswer} onSubmit={() => respond.mutate(answer)} />;

  return (
    <>
      <section className="rounded-[24px] border border-teal-100 bg-white p-5 shadow-sm sm:p-7" data-testid="symptom-assessment-panel">
        <SectionHeading eyebrow="GUIDED CHECK" title="Let’s understand your symptoms. I’ll ask a few questions." description="This is a bounded demo pathway. Your answers provide guidance, not a diagnosis." icon={HeartPulse} />
        {body}
      </section>
      {!result?.complete && !pending && <QuickChoicePanel assessment={assessment} choices={choicesFor(assessment)} onChoose={choose} onOther={focusOther} />}
    </>
  );
}

function AssessmentStartForm({ answer, setAnswer, onStart }: { answer: string; setAnswer: (value: string) => void; onStart: () => void }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="In your own words, what are you experiencing?" className="min-h-28 bg-white" data-testid="symptom-description-input" /><Button onClick={onStart} className="mt-3 bg-teal-700 hover:bg-teal-800" data-testid="symptom-start-button">Continue with a few questions<ArrowRight size={16} /></Button></div>;
}

function AssessmentQuestion({ assessment, answer, setAnswer, onSubmit }: { assessment: AssessmentStart; answer: string; setAnswer: (value: string) => void; onSubmit: () => void }) {
  const progress = ((assessment.question_index + 1) / assessment.total_questions) * 100;
  return <div className="rounded-2xl border border-slate-200 p-5" data-testid="assessment-question-card"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-teal-700">Question {assessment.question_index + 1} of {assessment.total_questions}</span><span className="text-xs text-slate-400">{Math.round(progress)}%</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600 transition-[width] duration-200" style={{ width: `${progress}%` }} /></div><h3 className="mt-6 font-heading text-xl font-semibold text-slate-900">{assessment.question || "Please answer the next safety question."}</h3><Input value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && answer) onSubmit(); }} placeholder="Type a short answer" className="mt-4" data-testid="symptom-answer-input" /><Button onClick={onSubmit} disabled={!answer} className="mt-3 bg-teal-700 hover:bg-teal-800" data-testid="symptom-next-button">Next question<ArrowRight size={16} /></Button></div>;
}

function PatientIdentityCard() {
  const queryClient = useQueryClient();
  const identity = useQuery({ queryKey: ["patient-identity"], queryFn: () => apiGet<PatientIdentity>("/patient/identity"), staleTime: 10 * 60 * 1000 });
  const refresh = useMutation({ mutationFn: () => apiPost<PatientIdentity>("/patient/identity/refresh-qr"), onSuccess: (data) => queryClient.setQueryData(["patient-identity"], data) });
  const consent = useMutation({ mutationFn: () => apiPost<ConsentCodeResponse>("/patient/identity/consent-code") });
  const copy = async (value: string, label: string) => { await navigator.clipboard.writeText(value); toast.success(`${label} copied`); };
  if (identity.isLoading) return <div className="h-44 animate-pulse rounded-[24px] bg-slate-100" data-testid="patient-identity-loading" />;
  if (!identity.data) return <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800" data-testid="patient-identity-error">Identity card is temporarily unavailable. Your health profile remains safe.</div>;
  const data = refresh.data ?? identity.data;
  return <section className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_auto]" data-testid="patient-identity-card"><div><div className="flex items-center gap-2"><div className="grid size-9 place-items-center rounded-xl bg-teal-50 text-teal-700"><KeyRound size={18} /></div><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700">YOUR PERSISTENT IDENTITY</p><h2 className="font-heading text-xl font-semibold text-slate-900">One record, three safe ways to find it</h2></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Patient Code</p><div className="mt-1 flex items-center justify-between gap-3"><p className="font-mono text-xl font-bold tracking-wider text-slate-900" data-testid="patient-code-value">{data.patient_code}</p><Button variant="ghost" size="icon-sm" onClick={() => copy(data.patient_code, "Patient Code")} data-testid="copy-patient-code-button"><Copy size={15} /></Button></div></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Normalized phone</p><div className="mt-1 flex items-center gap-2"><Smartphone size={16} className="text-teal-700" /><p className="font-mono font-semibold text-slate-900" data-testid="patient-phone-value">{data.normalized_phone}</p></div></div></div><div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-amber-900">Authorize a provider</p><p className="text-xs text-amber-800/75">Generate a one-time 6-digit code after a doctor confirms your identity.</p></div><Button onClick={() => consent.mutate()} disabled={consent.isPending} className="bg-amber-700 hover:bg-amber-800" data-testid="generate-consent-code-button">{consent.isPending ? "Generating…" : "Generate consent code"}</Button></div>{consent.data && <div className="mt-3 flex items-center justify-between rounded-xl bg-white p-3" data-testid="patient-consent-code"><div><p className="font-mono text-2xl font-bold tracking-[.3em] text-slate-900">{consent.data.consent_code}</p><p className="mt-1 text-[11px] text-slate-500">One use · expires {new Date(consent.data.expires_at).toLocaleTimeString()}</p></div><Button variant="ghost" size="icon-sm" onClick={() => copy(consent.data.consent_code, "Consent code")} data-testid="copy-consent-code-button"><Copy size={15} /></Button></div>}</div></div><div className="flex min-w-48 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4"><img src={data.qr_svg_data_url} alt="CareSetu secure patient QR" className="size-40 rounded-xl bg-white p-2" data-testid="patient-qr-image" /><p className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-700"><QrCode size={14} /> Secure opaque QR</p><p className="mt-1 text-center text-[10px] text-slate-400">No medical details are embedded</p><Button variant="ghost" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending} className="mt-2" data-testid="refresh-qr-button"><RefreshCw size={13} /> Refresh QR</Button></div></section>;
}

function AssessmentResult({ onClose }: { onClose: () => void }) {
  return <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5" data-testid="assessment-normal-result"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 text-teal-700" /><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700">CARE DIRECTION · NORMAL</p><h3 className="mt-1 font-heading text-xl font-semibold text-slate-900">Based on your answers, please consult a doctor.</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">No autonomous diagnosis was made. Bring this summary to a doctor if your symptoms continue or change.</p></div></div><Button variant="outline" className="mt-4 border-teal-200" onClick={onClose} data-testid="assessment-close-button">Done</Button></div>;
}

function HealthProfileCard({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Profile>(() => profile);
  const save = useMutation({ mutationFn: () => apiPut<Profile>("/patient/profile", { name: form.name, age: form.age, gender: form.gender, mobile: form.mobile, location: form.location, address: form.address, emergency_contact: form.emergency_contact, blood_group: form.blood_group, weight_kg: form.weight_kg, existing_conditions: form.existing_conditions, allergies: form.allergies, medicines: form.medicines, previous_history: form.previous_history } satisfies ProfileUpdate), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Health profile saved"); } });
  return <Card className="border-slate-200 shadow-none" data-testid="health-profile-card"><CardHeader className="flex-row items-center justify-between space-y-0"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">YOUR HEALTH PROFILE</p><CardTitle className="mt-1 font-heading text-lg">Ready for the right context</CardTitle></div><Button variant="outline" size="sm" onClick={() => setEditing((value) => !value)} data-testid="profile-edit-toggle-button">{editing ? "Close" : "Edit profile"}</Button></CardHeader><CardContent>{editing ? <ProfileForm form={form} setForm={setForm} onSave={() => save.mutate()} saving={save.isPending} /> : <ProfileSummary profile={form} />}</CardContent></Card>;
}

function ProfileForm({ form, setForm, onSave, saving }: { form: Profile; setForm: (profile: Profile) => void; onSave: () => void; saving: boolean }) {
  const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
  return <div className="grid gap-3 sm:grid-cols-2"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} aria-label="Name" data-testid="profile-name-input" /><Input type="number" value={form.age} onChange={(event) => setForm({ ...form, age: Number(event.target.value) })} aria-label="Age" data-testid="profile-age-input" /><Input value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} aria-label="Gender" data-testid="profile-gender-input" /><Input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} aria-label="Mobile" data-testid="profile-mobile-input" /><Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} aria-label="Location" data-testid="profile-location-input" /><Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} aria-label="Address" data-testid="profile-address-input" /><Input value={form.emergency_contact} onChange={(event) => setForm({ ...form, emergency_contact: event.target.value })} aria-label="Emergency contact" data-testid="profile-emergency-contact-input" /><Input value={form.blood_group || ""} onChange={(event) => setForm({ ...form, blood_group: event.target.value })} aria-label="Blood group" data-testid="profile-blood-group-input" /><Input type="number" value={form.weight_kg || ""} onChange={(event) => setForm({ ...form, weight_kg: event.target.value ? Number(event.target.value) : null })} aria-label="Weight in kilograms" data-testid="profile-weight-input" /><Input value={form.existing_conditions.join(", ")} onChange={(event) => setForm({ ...form, existing_conditions: list(event.target.value) })} aria-label="Existing conditions" data-testid="profile-conditions-input" /><Input value={form.allergies.join(", ")} onChange={(event) => setForm({ ...form, allergies: list(event.target.value) })} aria-label="Allergies" data-testid="profile-allergies-input" /><Input value={form.medicines.join(", ")} onChange={(event) => setForm({ ...form, medicines: list(event.target.value) })} aria-label="Current medicines" data-testid="profile-medicines-input" /><Input value={form.previous_history.join(", ")} onChange={(event) => setForm({ ...form, previous_history: list(event.target.value) })} aria-label="Previous medical history" data-testid="profile-history-input" /><Button onClick={onSave} disabled={saving} className="bg-teal-700 hover:bg-teal-800 sm:col-span-2" data-testid="profile-save-button">{saving ? "Saving…" : "Save health profile"}</Button></div>;
}

function ProfileSummary({ profile }: { profile: Profile }) {
  return <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-red-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-red-700">Allergy</p><p className="mt-1 text-sm font-medium text-slate-800">{profile.allergies.join(", ") || "None recorded"}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Medicines</p><p className="mt-1 text-sm font-medium text-slate-800">{profile.medicines.join(", ") || "None recorded"}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">History</p><p className="mt-1 text-sm font-medium text-slate-800">{profile.previous_history.join(", ")}</p></div></div>;
}

function ReferralSummary({ referral }: { referral?: Referral }) {
  return <Card className="border-slate-200 shadow-none" data-testid="referral-summary-card"><CardHeader><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">CARE CONNECTIONS</p><CardTitle className="mt-1 font-heading text-lg">Recent referral</CardTitle></CardHeader><CardContent>{referral ? <div><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">{referral.facility_name}</p><p className="mt-1 text-xs text-slate-500">{referral.id} · {referral.care_requirement}</p></div><Badge className={statusTone(referral.status)}>{referral.status}</Badge></div><div className="mt-4"><Timeline events={referral.events} /></div></div> : <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500" data-testid="referral-empty-state">No referrals yet. A confirmed doctor referral will appear here.</div>}</CardContent></Card>;
}

function documentLabel(document: DocumentItem) {
  if (document.review_status === "needs_verification") return "AI extracted — needs verification";
  if (document.review_status === "unreadable") return "Could not reliably extract information from this document.";
  return document.review_status;
}

function DocumentsSection({ documents }: { documents: DocumentItem[] }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const upload = useMutation({ mutationFn: () => apiUpload<DocumentItem>("/documents/upload", file as File), onSuccess: () => { setFile(null); queryClient.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Document preserved for review"); } });
  return <section className="rounded-[24px] border border-slate-200 bg-white p-5" data-testid="documents-card"><SectionHeading eyebrow="MEDICAL DOCUMENTS" title="Keep reports together" description="Original files stay available. Candidate extraction remains unverified until an authorized provider reviews it." icon={FileText} /><div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-white text-teal-700 shadow-sm"><Upload size={18} /></div><div><p className="text-sm font-semibold text-slate-800">Upload a PDF or image report</p><p className="text-xs text-slate-500">For the demo, add “unreadable” to a filename to view the safe failure state.</p></div></div><div className="flex flex-col gap-2 sm:flex-row"><Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} className="max-w-[230px] bg-white text-xs" data-testid="document-file-input" /><Button onClick={() => file && upload.mutate()} disabled={!file || upload.isPending} className="bg-teal-700 hover:bg-teal-800" data-testid="document-upload-button">{upload.isPending ? "Reading…" : "Upload"}</Button></div></div><DocumentList documents={documents} /></section>;
}

function DocumentList({ documents }: { documents: DocumentItem[] }) {
  if (documents.length === 0) return <p className="mt-4 text-sm text-slate-400" data-testid="documents-empty-state">No documents uploaded yet.</p>;
  return <div className="mt-4 space-y-2">{documents.map((document) => <div key={document.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`document-${document.id}-row`}><div className="flex min-w-0 items-center gap-3"><FileText className="shrink-0 text-slate-400" size={18} /><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{document.filename}</p><p className="text-xs text-slate-500">Original preserved · {(document.size_bytes / 1024).toFixed(1)} KB · {document.extraction_mode}</p>{document.extracted_fields.length > 0 && <p className="mt-1 text-xs text-slate-600">Candidate fields: {document.extracted_fields.join(" · ")}</p>}</div></div><div className="flex min-w-0 flex-wrap items-center gap-2"><Badge className={statusTone(document.review_status)}>{documentLabel(document)}</Badge></div></div>)}</div>;
}

export default function PatientWorkspace({ state }: { state: DashboardState & { profile: Profile } }) {
  const queryClient = useQueryClient();
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [sos, setSos] = useState<SOSResponse | null>(null);
  const [selectedFacility, setSelectedFacility] = useState("");
  const sosKey = useRef(crypto.randomUUID());
  const startSos = useMutation({ mutationFn: () => apiPost<SOSResponse>("/sos", { note: "Patient initiated the demo SOS flow.", idempotency_key: sosKey.current }), onSuccess: (response) => { setSos(response); queryClient.invalidateQueries({ queryKey: ["dashboard"] }); } });
  const notifyHospital = useMutation({ mutationFn: () => apiPost<SOSResponse>("/sos/select-facility", { sos_id: sos?.event.id, facility_id: selectedFacility }), onSuccess: (response) => { setSos(response); queryClient.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Hospital notified"); } });
  const beginSos = () => { setSos(null); setSelectedFacility(""); sosKey.current = crypto.randomUUID(); startSos.mutate(); };

  return <div className="space-y-6" data-testid="patient-workspace"><PatientHero profile={state.profile} /><PatientIdentityCard /><PrimaryActions onAssessment={() => setAssessmentOpen(true)} onSos={beginSos} sosPending={startSos.isPending} />{sos && <EmergencyPanel response={sos} selectedFacility={selectedFacility} onSelect={setSelectedFacility} onNotify={() => notifyHospital.mutate()} notifying={notifyHospital.isPending} />}{assessmentOpen && <SymptomAssessment onClose={() => setAssessmentOpen(false)} />}<section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><HealthProfileCard profile={state.profile} /><ReferralSummary referral={state.referrals[0]} /></section><DocumentsSection documents={state.documents} /></div>;
}