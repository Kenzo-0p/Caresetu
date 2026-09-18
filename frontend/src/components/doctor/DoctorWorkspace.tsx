import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Activity, ArrowRight, Building2, Camera, CheckCircle2, ClipboardCheck, FileCheck2, FileX2, KeyRound, LockKeyhole, Phone, QrCode, Search, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";

import { FacilityCard, SectionHeading } from "@/components/CareComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiPost } from "@/lib/api";
import type { AuthorizedPatientAccess, DashboardState, DoctorAssessment, DocumentItem, IdentityLookupRequest, IdentityPreview, Profile, Referral, ReferralCreate } from "@/types/domain";

type LookupMethod = IdentityLookupRequest["method"];

function apiError(error: unknown) {
  if (error instanceof ApiError && error.body && typeof error.body === "object" && "detail" in error.body) return String(error.body.detail);
  return "The request could not be completed safely.";
}

function QrScanner({ onDecoded }: { onDecoded: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => controlsRef.current?.stop(), []);

  const startCamera = async () => {
    setError("");
    setScanning(true);
    try {
      const reader = new BrowserQRCodeReader();
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (!result) return;
        onDecoded(result.getText());
        controlsRef.current?.stop();
        setScanning(false);
        toast.success("Secure patient QR scanned");
      });
    } catch {
      setScanning(false);
      setError("Camera scanning is unavailable. Upload a QR image or use Patient Code / Phone.");
    }
  };

  const scanImage = async (file: File) => {
    setError("");
    const url = URL.createObjectURL(file);
    try {
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      onDecoded(result.getText());
      toast.success("QR image decoded");
    } catch {
      setError("No valid CareSetu QR could be read from that image.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" data-testid="qr-scanner-panel"><video ref={videoRef} className={`aspect-video w-full rounded-xl bg-slate-950 object-cover ${scanning ? "block" : "hidden"}`} muted playsInline data-testid="qr-camera-preview" /><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Button type="button" onClick={startCamera} disabled={scanning} className="bg-teal-700 hover:bg-teal-800" data-testid="start-qr-camera-button"><Camera size={15} />{scanning ? "Scanning…" : "Scan with camera"}</Button><label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Upload size={15} />Upload QR image<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) scanImage(file); }} data-testid="qr-image-input" /></label></div>{error && <p className="mt-3 text-xs text-red-700" data-testid="qr-scanner-error">{error}</p>}</div>;
}

function MethodTabs({ method, onChange }: { method: LookupMethod; onChange: (method: LookupMethod) => void }) {
  const methods: Array<{ value: LookupMethod; label: string; icon: typeof KeyRound }> = [
    { value: "patient_code", label: "Patient Code", icon: KeyRound },
    { value: "phone", label: "Phone Number", icon: Phone },
    { value: "qr", label: "Scan QR", icon: QrCode },
  ];
  return <div className="grid grid-cols-3 gap-2" data-testid="identity-method-tabs">{methods.map((item) => { const Icon = item.icon; const selected = method === item.value; return <button type="button" key={item.value} onClick={() => onChange(item.value)} className={`rounded-xl border p-3 text-left transition-colors duration-150 ${selected ? "border-teal-500 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-600 hover:border-teal-300"}`} data-testid={`lookup-method-${item.value}`}><Icon size={17} /><p className="mt-2 text-xs font-semibold">{item.label}</p></button>; })}</div>;
}

function IdentityLookup({ method, value, pending, error, onMethod, onValue, onIdentify }: { method: LookupMethod; value: string; pending: boolean; error: string; onMethod: (method: LookupMethod) => void; onValue: (value: string) => void; onIdentify: () => void }) {
  const placeholder = method === "patient_code" ? "PAT-7K4M92" : method === "phone" ? "+91 98765 43210" : "Scan, upload, or paste a CareSetu QR value";
  return <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm" data-testid="doctor-lookup-section"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">SECURE PATIENT ACCESS</p><h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-950">Identify first. Authorize before history.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">QR, Patient Code and phone all resolve to the same database record. Identification shows no clinical history.</p></div><div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800"><LockKeyhole size={15} /> One-time patient consent required</div></div><div className="mt-6 grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><MethodTabs method={method} onChange={onMethod} /><div>{method === "qr" && <QrScanner onDecoded={onValue} />}<div className={method === "qr" ? "mt-3" : ""}><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><Input value={value} onChange={(event) => onValue(event.target.value)} className="pl-9" placeholder={placeholder} data-testid="doctor-patient-lookup-input" /></div><Button onClick={onIdentify} disabled={!value || pending} className="mt-3 w-full bg-teal-700 hover:bg-teal-800" data-testid="doctor-identify-button">{pending ? "Checking identity…" : "Identify patient"}<ArrowRight size={16} /></Button>{error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700" data-testid="doctor-identify-error">{error}</p>}</div></div></div></section>;
}

function AuthorizationStep({ preview, code, pending, error, onCode, onAuthorize }: { preview: IdentityPreview; code: string; pending: boolean; error: string; onCode: (value: string) => void; onAuthorize: () => void }) {
  return <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5" data-testid="identity-confirmation-step"><div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><ShieldCheck size={19} /></div><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800">IDENTITY MATCH · HISTORY LOCKED</p><h2 className="mt-1 font-heading text-xl font-semibold text-slate-900">Confirm {preview.name}, {preview.age}</h2><p className="mt-1 text-sm text-slate-600">{preview.patient_code} · {preview.gender} · {preview.masked_phone}</p><p className="mt-3 text-sm text-amber-900/75">Ask the patient for the one-time consent code shown in their CareSetu identity card. Knowing a phone number or code alone never unlocks medical data.</p></div></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={code} onChange={(event) => onCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit consent code" className="bg-white font-mono tracking-[.25em]" data-testid="provider-consent-code-input" /><Button onClick={onAuthorize} disabled={code.length !== 6 || pending} className="bg-amber-700 hover:bg-amber-800" data-testid="provider-authorize-button">{pending ? "Verifying…" : "Authorize & open record"}</Button></div>{error && <p className="mt-3 text-sm text-red-700" data-testid="provider-authorize-error">{error}</p>}</section>;
}

function PatientSummary({ patient, access }: { patient: Profile; access: AuthorizedPatientAccess }) {
  return <Card className="border-red-100 bg-white shadow-none" data-testid="doctor-patient-summary"><CardHeader><div className="flex items-center justify-between gap-2"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-700">AUTHORIZED PATIENT</p><Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">CONSENT VERIFIED</Badge></div><CardTitle className="mt-1 font-heading text-xl">{patient.name}, {patient.age}</CardTitle><p className="text-sm text-slate-500">{patient.patient_code} · {patient.location}</p></CardHeader><CardContent className="space-y-3"><div className="rounded-xl bg-red-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-red-700">Allergies</p><p className="mt-1 font-medium text-slate-800">{patient.allergies.join(", ") || "None recorded"}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Current medicines</p><p className="mt-1 text-sm text-slate-800">{patient.medicines.join(", ") || "None recorded"}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">History</p><p className="mt-1 text-sm text-slate-800">{patient.previous_history.join(", ") || "No history recorded"}</p></div><p className="text-[11px] text-slate-400">Authorized until {new Date(access.expires_at).toLocaleTimeString()} · access audit recorded</p></CardContent></Card>;
}

function PatientDocuments({ access, onReview }: { access: AuthorizedPatientAccess; onReview: (document: DocumentItem, decision: "verified" | "rejected") => void }) {
  if (access.documents.length === 0) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500" data-testid="doctor-documents-empty">No medical documents uploaded.</div>;
  return <section className="rounded-2xl border border-slate-200 bg-white p-4" data-testid="doctor-documents-section"><p className="font-heading font-semibold text-slate-900">Medical documents</p><div className="mt-3 space-y-2">{access.documents.map((document) => <div key={document.id} className="rounded-xl bg-slate-50 p-3" data-testid={`doctor-document-${document.id}`}><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-slate-800">{document.filename}</p><p className="mt-1 text-xs text-slate-500">Original preserved · {document.review_status}</p>{document.extracted_fields.length > 0 && <p className="mt-1 text-xs text-slate-600">Unverified candidates: {document.extracted_fields.join(" · ")}</p>}</div>{document.review_status === "needs_verification" && <div className="flex gap-2"><Button size="sm" onClick={() => onReview(document, "verified")} data-testid={`doctor-document-${document.id}-verify`}><FileCheck2 size={14} />Verify</Button><Button size="sm" variant="outline" onClick={() => onReview(document, "rejected")} data-testid={`doctor-document-${document.id}-reject`}><FileX2 size={14} />Reject</Button></div>}</div></div>)}</div></section>;
}

function PriorReferralSummary({ referrals }: { referrals: Referral[] }) {
  if (referrals.length === 0) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500" data-testid="doctor-prior-referrals-empty">No prior referrals recorded.</div>;
  return <section className="rounded-2xl border border-slate-200 bg-white p-4" data-testid="doctor-prior-referrals"><p className="font-heading font-semibold text-slate-900">Prior referrals</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{referrals.slice(0, 4).map((referral) => <div key={referral.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-800">{referral.facility_name}</p><p className="mt-1 text-xs text-slate-500">{referral.care_requirement} · {referral.status}</p></div>)}</div></section>;
}

function CurrentAssessment({ symptoms, findings, vitals, pending, onSymptoms, onFindings, onVitals, onReview }: { symptoms: string; findings: string; vitals: string; pending: boolean; onSymptoms: (value: string) => void; onFindings: (value: string) => void; onVitals: (value: string) => void; onReview: () => void }) {
  return <Card className="border-slate-200 shadow-none"><CardHeader><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal-700">CURRENT ASSESSMENT</p><CardTitle className="mt-1 font-heading text-xl">What needs attention today?</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea value={symptoms} onChange={(event) => onSymptoms(event.target.value)} placeholder="Current symptoms" className="min-h-24" data-testid="doctor-symptoms-input" /><Textarea value={findings} onChange={(event) => onFindings(event.target.value)} placeholder="Clinical findings" className="min-h-20" data-testid="doctor-findings-input" /><Input value={vitals} onChange={(event) => onVitals(event.target.value)} placeholder="Supported vitals, e.g. BP 120/80, pulse 78" data-testid="doctor-vitals-input" /><Button onClick={onReview} disabled={!symptoms || pending} className="bg-teal-700 hover:bg-teal-800" data-testid="doctor-ai-review-button">{pending ? "Preparing safe assistance…" : "Review AI/rule-assisted assessment"}<ClipboardCheck size={16} /></Button></CardContent></Card>;
}

function AssistanceCard({ assistance, onOverride }: { assistance: DoctorAssessment | null; onOverride: () => void }) {
  return <section className="rounded-[24px] border border-amber-200 bg-[#fffbeb] p-5" data-testid="ai-assessment-card"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><div className="grid size-8 place-items-center rounded-xl bg-amber-100 text-amber-700"><Activity size={17} /></div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800">AI/rule-assisted assessment</p></div><h2 className="mt-2 font-heading text-xl font-semibold text-slate-900">Supportive, bounded, editable</h2></div><Badge className="w-fit border-amber-200 bg-amber-100 text-amber-800">DETERMINISTIC FALLBACK ACTIVE</Badge></div>{assistance ? <div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-white p-3"><p className="text-[11px] uppercase tracking-wider text-slate-400">Urgency</p><p className="mt-1 font-semibold text-slate-800">{assistance.urgency}</p></div><div className="rounded-xl bg-white p-3"><p className="text-[11px] uppercase tracking-wider text-slate-400">Care requirement</p><p className="mt-1 font-semibold text-slate-800">{assistance.care_requirement}</p></div><div className="rounded-xl bg-white p-3"><p className="text-[11px] uppercase tracking-wider text-slate-400">Capabilities</p><p className="mt-1 text-sm font-semibold text-slate-800">{assistance.suggested_capabilities.join(" · ")}</p></div><div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-sm leading-relaxed text-slate-700 md:col-span-3">{assistance.summary}</div></div> : <p className="mt-3 text-sm text-slate-600">Structured inputs produce bounded assistance. Your decision remains authoritative.</p>}<div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={onOverride} disabled={!assistance} data-testid="doctor-override-button">Override assistance</Button>{assistance && <Badge className="border-teal-200 bg-teal-50 text-teal-700" data-testid="doctor-decision-authoritative">Doctor decision authoritative</Badge>}</div></section>;
}

function FacilityMatching({ state, selected, assistance, draft, pending, onSelect, onDraft, onConfirm }: { state: DashboardState; selected: string; assistance: DoctorAssessment | null; draft: Referral | null; pending: boolean; onSelect: (id: string) => void; onDraft: () => void; onConfirm: () => void }) {
  const facilities = assistance?.urgency === "URGENT" ? state.facilities.filter((facility) => facility.emergency_ready) : state.facilities;
  let action;
  if (!draft) action = <Button onClick={onDraft} disabled={!assistance || !selected || pending} className="bg-teal-700 hover:bg-teal-800" data-testid="doctor-create-referral-draft-button">{pending ? "Creating draft…" : "Preview referral"}<ArrowRight size={16} /></Button>;
  else if (draft.status === "DRAFT") action = <Button onClick={onConfirm} disabled={pending} className="bg-teal-700 hover:bg-teal-800" data-testid="doctor-confirm-referral-button">{pending ? "Sending…" : "Confirm & send referral"}<ArrowRight size={16} /></Button>;
  else action = <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" data-testid="doctor-referral-success">Referral received by hospital</Badge>;
  return <section data-testid="facility-matching-section"><SectionHeading eyebrow="CAPABILITY MATCHING" title="Suitable Facilities for This Care Requirement" description="Mandatory capabilities come first; location and fixed demo order are tie-breakers. No live capacity is claimed." icon={Building2} /><div className="grid gap-3 lg:grid-cols-3">{facilities.map((facility) => <FacilityCard key={facility.id} facility={facility} selected={selected === facility.id} onSelect={() => onSelect(facility.id)} />)}</div><div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-slate-800">Doctor confirmation is mandatory</p><p className="text-xs text-slate-500">Create a draft preview first, then confirm and send it to the hospital queue.</p></div>{action}</div>{draft && <div className="mt-4 rounded-xl bg-slate-50 p-3" data-testid="doctor-referral-preview"><p className="font-mono text-xs font-semibold text-slate-700">{draft.id} · {draft.status}</p><p className="mt-1 text-sm text-slate-600">{draft.patient_name} → {draft.facility_name}</p></div>}</div></section>;
}

export default function DoctorWorkspace({ state }: { state: DashboardState }) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<LookupMethod>("patient_code");
  const [identifier, setIdentifier] = useState("PAT-7K4M92");
  const [preview, setPreview] = useState<IdentityPreview | null>(null);
  const [consentCode, setConsentCode] = useState("");
  const [access, setAccess] = useState<AuthorizedPatientAccess | null>(null);
  const [symptoms, setSymptoms] = useState("Persistent tiredness and mild chest discomfort after exertion.");
  const [findings, setFindings] = useState("");
  const [vitals, setVitals] = useState("");
  const [assistance, setAssistance] = useState<DoctorAssessment | null>(null);
  const [selectedFacility, setSelectedFacility] = useState("");
  const [draft, setDraft] = useState<Referral | null>(null);
  const idempotencyRef = useRef(crypto.randomUUID());
  const identify = useMutation({ mutationFn: () => apiPost<IdentityPreview>("/provider/identify", { method, value: identifier }), onSuccess: (result) => { setPreview(result); setAccess(null); setConsentCode(""); }, });
  const authorize = useMutation({ mutationFn: () => apiPost<AuthorizedPatientAccess>(`/provider/access/${preview?.access_request_id}/authorize`, { consent_code: consentCode }), onSuccess: (result) => { setAccess(result); toast.success("Patient consent verified and audit logged"); } });
  const review = useMutation({ mutationFn: () => apiPost<DoctorAssessment>("/doctor/assessment-assistance", { access_request_id: access?.access_request_id, symptoms, findings, vitals }), onSuccess: setAssistance });
  const createDraft = useMutation({ mutationFn: () => apiPost<Referral>("/referrals", { access_request_id: access?.access_request_id, facility_id: selectedFacility, reason: "Clinical review after current assessment", care_requirement: assistance?.care_requirement || "Primary care review", urgency: assistance?.urgency || "ROUTINE", symptoms, findings, vitals, ai_assessment: assistance?.summary || "", doctor_decision: "Confirmed by clinician after reviewing structured assistance.", idempotency_key: idempotencyRef.current } satisfies ReferralCreate), onSuccess: setDraft });
  const confirm = useMutation({ mutationFn: () => apiPost<Referral>(`/referrals/${draft?.id}/confirm`), onSuccess: (result) => { setDraft(result); queryClient.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Confirmed referral received by hospital"); } });
  const reviewDocument = useMutation({ mutationFn: ({ document, decision }: { document: DocumentItem; decision: "verified" | "rejected" }) => apiPost<DocumentItem>(`/documents/${document.id}/review`, { access_request_id: access?.access_request_id, decision }), onSuccess: (updated) => setAccess((current) => current ? { ...current, documents: current.documents.map((item) => item.id === updated.id ? updated : item) } : current) });
  const changeMethod = (next: LookupMethod) => { setMethod(next); setIdentifier(next === "patient_code" ? "PAT-7K4M92" : next === "phone" ? "+919876543210" : ""); identify.reset(); setPreview(null); setAccess(null); };
  const chooseFacility = (id: string) => { setSelectedFacility(id); setDraft(null); idempotencyRef.current = crypto.randomUUID(); };
  const override = () => { if (assistance) setAssistance({ ...assistance, summary: "Clinician override: specialist review selected based on current findings and professional judgment." }); };

  return <div className="space-y-6" data-testid="doctor-workspace"><IdentityLookup method={method} value={identifier} pending={identify.isPending} error={identify.isError ? apiError(identify.error) : ""} onMethod={changeMethod} onValue={setIdentifier} onIdentify={() => identify.mutate()} />{preview && !access && <AuthorizationStep preview={preview} code={consentCode} pending={authorize.isPending} error={authorize.isError ? apiError(authorize.error) : ""} onCode={setConsentCode} onAuthorize={() => authorize.mutate()} />}{access && <><section className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]"><PatientSummary patient={access.patient} access={access} /><CurrentAssessment symptoms={symptoms} findings={findings} vitals={vitals} pending={review.isPending} onSymptoms={setSymptoms} onFindings={setFindings} onVitals={setVitals} onReview={() => review.mutate()} /></section><div className="grid gap-4 lg:grid-cols-2"><PatientDocuments access={access} onReview={(document, decision) => reviewDocument.mutate({ document, decision })} /><PriorReferralSummary referrals={access.prior_referrals} /></div><AssistanceCard assistance={assistance} onOverride={override} /><FacilityMatching state={state} selected={selectedFacility} assistance={assistance} draft={draft} pending={createDraft.isPending || confirm.isPending} onSelect={chooseFacility} onDraft={() => createDraft.mutate()} onConfirm={() => confirm.mutate()} /></>}</div>;
}