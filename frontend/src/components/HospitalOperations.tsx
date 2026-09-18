import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, ClipboardCheck, Siren } from "lucide-react";
import { toast } from "sonner";

import { formatTime, Timeline } from "@/components/CareComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api";
import type { DashboardState, EmergencyEvent, Referral, ReferralActionRequest, Role } from "@/types/domain";

type Status = ReferralActionRequest["status"];
type StatusHandler = (id: string, status: Status, outcome?: string, reason?: string) => void;

function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function QueueHeader() {
  return <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm" data-testid="hospital-queue-header"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-center"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">HOSPITAL OPERATIONS · AUTHENTICATED QUEUE</p><h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-950">Incoming care, clearly prioritized.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Emergency items stay above routine referrals. Polling keeps stored queue state synchronized without duplicate subscriptions.</p></div><div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><BellRing size={15} className="text-teal-700" /> Secure 5-second polling fallback</div></div></section>;
}

function ReferralActions({ referral, prefix, role, onStatus, onOutcome, onException }: { referral: Referral; prefix: string; role: Role; onStatus: StatusHandler; onOutcome: (id: string) => void; onException: (id: string, status: "REJECTED" | "REDIRECTED") => void }) {
  if (referral.status === "RECEIVED") {
    return <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => onStatus(referral.id, "ACCEPTED")} className="bg-teal-700 hover:bg-teal-800" data-testid={`${prefix}-accept-button`}>Accept</Button><Button size="sm" variant="outline" onClick={() => onException(referral.id, "REDIRECTED")} data-testid={`${prefix}-redirect-button`}>Redirect</Button><Button size="sm" variant="outline" onClick={() => onException(referral.id, "REJECTED")} data-testid={`${prefix}-reject-button`}>Reject</Button></div>;
  }
  if (referral.status === "ACCEPTED") return <Button size="sm" onClick={() => onStatus(referral.id, "ARRIVED")} className="bg-teal-700 hover:bg-teal-800" data-testid={`${prefix}-arrived-button`}>Mark arrived</Button>;
  if (referral.status === "ARRIVED" && role === "hospital_doctor") return <Button size="sm" variant="outline" onClick={() => onOutcome(referral.id)} data-testid={`${prefix}-outcome-button`}>Record clinical outcome</Button>;
  return <Badge className="border-slate-200 bg-slate-50 text-slate-600">{humanize(referral.status)}</Badge>;
}

function OutcomeForm({ referralId, prefix, activeId, outcome, onOutcome, onSave }: { referralId: string; prefix: string; activeId: string; outcome: string; onOutcome: (value: string) => void; onSave: StatusHandler }) {
  if (activeId !== referralId) return null;
  return <div className="mt-3 flex flex-col gap-2 sm:flex-row" data-testid={`${prefix}-outcome-form`}><Input value={outcome} onChange={(event) => onOutcome(event.target.value)} placeholder="Clinical outcome and follow-up" data-testid={`${prefix}-outcome-input`} /><Button size="sm" disabled={!outcome} onClick={() => onSave(referralId, "COMPLETED", outcome)} data-testid={`${prefix}-outcome-save-button`}>Complete referral</Button></div>;
}

function ExceptionForm({ referralId, prefix, activeId, status, reason, onReason, onSave }: { referralId: string; prefix: string; activeId: string; status: "REJECTED" | "REDIRECTED" | null; reason: string; onReason: (value: string) => void; onSave: StatusHandler }) {
  if (activeId !== referralId || !status) return null;
  return <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3" data-testid={`${prefix}-exception-form`}><p className="text-xs font-semibold text-amber-900">Reason required to {status === "REJECTED" ? "reject" : "redirect"}</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input value={reason} onChange={(event) => onReason(event.target.value)} placeholder="Operational reason" className="bg-white" data-testid={`${prefix}-exception-reason-input`} /><Button size="sm" disabled={reason.trim().length < 3} onClick={() => onSave(referralId, status, undefined, reason)} data-testid={`${prefix}-exception-save-button`}>Confirm {status === "REJECTED" ? "rejection" : "redirect"}</Button></div></div>;
}

interface QueueActionProps {
  role: Role;
  activeOutcome: string;
  outcome: string;
  activeException: string;
  exceptionStatus: "REJECTED" | "REDIRECTED" | null;
  exceptionReason: string;
  onStatus: StatusHandler;
  onOpenOutcome: (id: string) => void;
  onOutcome: (value: string) => void;
  onOpenException: (id: string, status: "REJECTED" | "REDIRECTED") => void;
  onExceptionReason: (value: string) => void;
}

function EmergencyCard({ emergency, referral, ...actions }: { emergency: EmergencyEvent; referral?: Referral } & QueueActionProps) {
  const prefix = `emergency-${emergency.id}`;
  return <article className="rounded-[22px] border-2 border-red-200 bg-red-50 p-5" data-testid={`${prefix}-card`}><div className="flex flex-col justify-between gap-4 lg:flex-row"><div className="flex gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-600 text-white"><Siren size={22} /></div><div><p className="font-mono text-[10px] font-bold tracking-[0.16em] text-red-700">INCOMING EMERGENCY PATIENT</p><h3 className="mt-1 font-heading text-lg font-semibold text-slate-900">{emergency.patient_name}</h3><p className="mt-1 text-sm text-red-900/70">{humanize(emergency.status)} · {emergency.dispatch_status} · {formatTime(emergency.created_at)}</p><p className="mt-3 text-sm text-slate-700">Emergency-only summary first. Break-glass access is event-bound and audit logged.</p></div></div>{referral && <ReferralActions referral={referral} prefix={prefix} role={actions.role} onStatus={actions.onStatus} onOutcome={actions.onOpenOutcome} onException={actions.onOpenException} />}</div>{referral && <div className="mt-4 border-t border-red-200 pt-4"><p className="text-sm font-medium text-slate-800">{referral.facility_name} · {humanize(referral.status)}</p><OutcomeForm referralId={referral.id} prefix={prefix} activeId={actions.activeOutcome} outcome={actions.outcome} onOutcome={actions.onOutcome} onSave={actions.onStatus} /><ExceptionForm referralId={referral.id} prefix={prefix} activeId={actions.activeException} status={actions.exceptionStatus} reason={actions.exceptionReason} onReason={actions.onExceptionReason} onSave={actions.onStatus} /></div>}</article>;
}

function EmergencyQueue({ items, ...actions }: { items: Array<{ emergency: EmergencyEvent; referral?: Referral }> } & QueueActionProps) {
  if (items.length === 0) return null;
  const label = items.length === 1 ? "emergency event" : "emergency events";
  return <section data-testid="hospital-emergency-queue"><div className="mb-3"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-red-700">EMERGENCY FAST LANE</p><h2 className="font-heading text-xl font-semibold text-slate-900">{items.length} {label}</h2></div><div className="space-y-3">{items.map(({ emergency, referral }) => <EmergencyCard key={emergency.id} emergency={emergency} referral={referral} {...actions} />)}</div></section>;
}

function RoutineCard({ referral, ...actions }: { referral: Referral } & QueueActionProps) {
  const prefix = `referral-${referral.id}`;
  return <article className="rounded-2xl border border-slate-200 bg-white p-4" data-testid={`${prefix}-queue-card`}><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex items-center gap-2"><h3 className="font-heading font-semibold text-slate-900">{referral.patient_name}</h3><Badge className="border-slate-200 bg-slate-50 text-slate-600">{humanize(referral.status)}</Badge></div><p className="mt-1 text-sm text-slate-500">{referral.patient_code} · {referral.care_requirement}</p><p className="mt-2 text-xs text-slate-600">{referral.reason} · referred by {referral.referring_provider_name}</p></div><ReferralActions referral={referral} prefix={prefix} role={actions.role} onStatus={actions.onStatus} onOutcome={actions.onOpenOutcome} onException={actions.onOpenException} /></div><details className="mt-3 rounded-xl bg-slate-50 p-3" data-testid={`${prefix}-patient-details`}><summary className="cursor-pointer text-xs font-semibold text-slate-700">Authorized referral details</summary><div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2"><p><strong>Symptoms:</strong> {referral.symptoms || "Not recorded"}</p><p><strong>Findings:</strong> {referral.findings || "Not recorded"}</p><p><strong>Allergies:</strong> {referral.patient_summary.allergies.join(", ") || "None recorded"}</p><p><strong>Medicines:</strong> {referral.patient_summary.medicines.join(", ") || "None recorded"}</p></div></details><OutcomeForm referralId={referral.id} prefix={prefix} activeId={actions.activeOutcome} outcome={actions.outcome} onOutcome={actions.onOutcome} onSave={actions.onStatus} /><ExceptionForm referralId={referral.id} prefix={prefix} activeId={actions.activeException} status={actions.exceptionStatus} reason={actions.exceptionReason} onReason={actions.onExceptionReason} onSave={actions.onStatus} /><div className="mt-4 border-t border-slate-100 pt-4"><Timeline events={referral.events} testId={`${prefix}-timeline`} /></div></article>;
}

function RoutineQueue({ referrals, ...actions }: { referrals: Referral[] } & QueueActionProps) {
  if (referrals.length === 0) return null;
  return <section data-testid="hospital-referral-queue"><div className="mb-3"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">NORMAL REFERRALS</p><h2 className="font-heading text-xl font-semibold text-slate-900">Incoming referral queue</h2></div><div className="space-y-3">{referrals.map((referral) => <RoutineCard key={referral.id} referral={referral} {...actions} />)}</div></section>;
}

export default function HospitalOperations({ state, role }: { state: DashboardState; role: Role }) {
  const queryClient = useQueryClient();
  const [activeOutcome, setActiveOutcome] = useState("");
  const [outcome, setOutcome] = useState("");
  const [activeException, setActiveException] = useState("");
  const [exceptionStatus, setExceptionStatus] = useState<"REJECTED" | "REDIRECTED" | null>(null);
  const [exceptionReason, setExceptionReason] = useState("");
  const routineReferrals = useMemo(() => state.referrals.filter((item) => !item.emergency), [state.referrals]);
  const referralById = useMemo(() => new Map(state.referrals.map((referral) => [referral.id, referral])), [state.referrals]);
  const emergencyItems = useMemo(() => state.emergencies.map((emergency) => ({ emergency, referral: emergency.referral_id ? referralById.get(emergency.referral_id) : undefined })), [state.emergencies, referralById]);
  const update = useMutation({ mutationFn: ({ id, status, nextOutcome, reason }: { id: string; status: Status; nextOutcome?: string; reason?: string }) => apiPost<Referral>(`/referrals/${id}/status`, { status, outcome: nextOutcome, reason } satisfies ReferralActionRequest), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["dashboard"] }); setActiveOutcome(""); setOutcome(""); setActiveException(""); setExceptionReason(""); setExceptionStatus(null); toast.success("Referral status updated and audited"); } });
  const onStatus: StatusHandler = (id, status, nextOutcome, reason) => update.mutate({ id, status, nextOutcome, reason });
  const openOutcome = (id: string) => { setActiveOutcome(id); setOutcome(""); setActiveException(""); };
  const openException = (id: string, status: "REJECTED" | "REDIRECTED") => { setActiveException(id); setExceptionStatus(status); setExceptionReason(""); setActiveOutcome(""); };
  const actions: QueueActionProps = { role, activeOutcome, outcome, activeException, exceptionStatus, exceptionReason, onStatus, onOpenOutcome: openOutcome, onOutcome: setOutcome, onOpenException: openException, onExceptionReason: setExceptionReason };
  const empty = state.referrals.length === 0 && state.emergencies.length === 0;
  return <div className="space-y-6" data-testid="hospital-workspace"><QueueHeader /><EmergencyQueue items={emergencyItems} {...actions} /><RoutineQueue referrals={routineReferrals} {...actions} />{empty && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center" data-testid="hospital-empty-queue"><ClipboardCheck className="mx-auto text-slate-300" size={28} /><p className="mt-3 font-semibold text-slate-700">No incoming referrals yet</p><p className="mt-1 text-sm text-slate-500">The authenticated facility queue will refresh automatically.</p></div>}</div>;
}