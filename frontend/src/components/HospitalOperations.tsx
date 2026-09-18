import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, ClipboardCheck, Siren } from "lucide-react";
import { toast } from "sonner";

import { formatTime, Timeline } from "@/components/CareComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api";
import type { DemoState, EmergencyEvent, Referral } from "@/types/domain";

type Status = "Accepted" | "Rejected" | "Redirected" | "Arrived" | "Outcome Updated";
type StatusHandler = (id: string, status: Status, outcome?: string) => void;

function QueueHeader() {
  return <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm" data-testid="hospital-queue-header"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-center"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">HOSPITAL OPERATIONS · SHARED DEMO QUEUE</p><h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-950">Incoming care, clearly prioritized.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Emergency items stay above routine referrals. Stored queue state remains usable even without realtime delivery.</p></div><div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><BellRing size={15} className="text-teal-700" /> Database-backed queue</div></div></section>;
}

function ReferralActions({ referral, prefix, onStatus, onOutcome }: { referral: Referral; prefix: string; onStatus: StatusHandler; onOutcome: (id: string) => void }) {
  if (referral.status === "Sent") {
    return <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => onStatus(referral.id, "Accepted")} className="bg-teal-700 hover:bg-teal-800" data-testid={`${prefix}-accept-button`}>Accept</Button><Button size="sm" variant="outline" onClick={() => onStatus(referral.id, "Redirected")} data-testid={`${prefix}-redirect-button`}>Redirect</Button><Button size="sm" variant="outline" onClick={() => onStatus(referral.id, "Rejected")} data-testid={`${prefix}-reject-button`}>Reject</Button></div>;
  }
  if (referral.status === "Accepted") {
    return <Button size="sm" onClick={() => onStatus(referral.id, "Arrived")} className="bg-teal-700 hover:bg-teal-800" data-testid={`${prefix}-arrived-button`}>Mark arrived</Button>;
  }
  if (referral.status === "Arrived") {
    return <Button size="sm" variant="outline" onClick={() => onOutcome(referral.id)} data-testid={`${prefix}-outcome-button`}>Update outcome</Button>;
  }
  return <Badge className="border-slate-200 bg-slate-50 text-slate-600">{referral.status}</Badge>;
}

function OutcomeForm({ referralId, prefix, activeId, outcome, onOutcome, onSave }: { referralId: string; prefix: string; activeId: string; outcome: string; onOutcome: (value: string) => void; onSave: StatusHandler }) {
  if (activeId !== referralId) return null;
  return <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={outcome} onChange={(event) => onOutcome(event.target.value)} placeholder="Outcome note" data-testid={`${prefix}-outcome-input`} /><Button size="sm" disabled={!outcome} onClick={() => onSave(referralId, "Outcome Updated", outcome)} data-testid={`${prefix}-outcome-save-button`}>Save outcome</Button></div>;
}

function EmergencyCard({ emergency, referral, activeOutcome, outcome, onStatus, onOpenOutcome, onOutcome }: { emergency: EmergencyEvent; referral?: Referral; activeOutcome: string; outcome: string; onStatus: StatusHandler; onOpenOutcome: (id: string) => void; onOutcome: (value: string) => void }) {
  const prefix = `emergency-${emergency.id}`;
  return <article className="rounded-[22px] border-2 border-red-200 bg-red-50 p-5" data-testid={`${prefix}-card`}><div className="flex flex-col justify-between gap-4 lg:flex-row"><div className="flex gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-600 text-white"><Siren size={22} /></div><div><p className="font-mono text-[10px] font-bold tracking-[0.16em] text-red-700">INCOMING EMERGENCY PATIENT</p><h3 className="mt-1 font-heading text-lg font-semibold text-slate-900">{emergency.patient_name}</h3><p className="mt-1 text-sm text-red-900/70">{emergency.status} · {emergency.dispatch_status} · {formatTime(emergency.created_at)}</p><p className="mt-3 text-sm text-slate-700">Emergency-only summary first. Break-glass access is limited and audited.</p></div></div>{referral && <ReferralActions referral={referral} prefix={prefix} onStatus={onStatus} onOutcome={onOpenOutcome} />}</div>{referral && <div className="mt-4 border-t border-red-200 pt-4"><p className="text-sm font-medium text-slate-800">{referral.facility_name} · {referral.status}</p><OutcomeForm referralId={referral.id} prefix={prefix} activeId={activeOutcome} outcome={outcome} onOutcome={onOutcome} onSave={onStatus} /></div>}</article>;
}

function EmergencyQueue({ items, activeOutcome, outcome, onStatus, onOpenOutcome, onOutcome }: { items: Array<{ emergency: EmergencyEvent; referral?: Referral }>; activeOutcome: string; outcome: string; onStatus: StatusHandler; onOpenOutcome: (id: string) => void; onOutcome: (value: string) => void }) {
  if (items.length === 0) return null;
  const label = items.length === 1 ? "emergency event" : "emergency events";
  return <section data-testid="hospital-emergency-queue"><div className="mb-3"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-red-700">EMERGENCY FAST LANE</p><h2 className="font-heading text-xl font-semibold text-slate-900">{items.length} {label}</h2></div><div className="space-y-3">{items.map(({ emergency, referral }) => <EmergencyCard key={emergency.id} emergency={emergency} referral={referral} activeOutcome={activeOutcome} outcome={outcome} onStatus={onStatus} onOpenOutcome={onOpenOutcome} onOutcome={onOutcome} />)}</div></section>;
}

function RoutineCard({ referral, activeOutcome, outcome, onStatus, onOpenOutcome, onOutcome }: { referral: Referral; activeOutcome: string; outcome: string; onStatus: StatusHandler; onOpenOutcome: (id: string) => void; onOutcome: (value: string) => void }) {
  const prefix = `referral-${referral.id}`;
  return <article className="rounded-2xl border border-slate-200 bg-white p-4" data-testid={`${prefix}-queue-card`}><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h3 className="font-heading font-semibold text-slate-900">{referral.patient_name}</h3><p className="mt-1 text-sm text-slate-500">{referral.facility_name} · {referral.care_requirement}</p><p className="mt-2 text-xs text-slate-600">{referral.reason}</p></div><ReferralActions referral={referral} prefix={prefix} onStatus={onStatus} onOutcome={onOpenOutcome} /></div><OutcomeForm referralId={referral.id} prefix={prefix} activeId={activeOutcome} outcome={outcome} onOutcome={onOutcome} onSave={onStatus} /><div className="mt-4 border-t border-slate-100 pt-4"><Timeline events={referral.events} testId={`${prefix}-timeline`} /></div></article>;
}

function RoutineQueue({ referrals, activeOutcome, outcome, onStatus, onOpenOutcome, onOutcome }: { referrals: Referral[]; activeOutcome: string; outcome: string; onStatus: StatusHandler; onOpenOutcome: (id: string) => void; onOutcome: (value: string) => void }) {
  if (referrals.length === 0) return null;
  return <section data-testid="hospital-referral-queue"><div className="mb-3"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">NORMAL REFERRALS</p><h2 className="font-heading text-xl font-semibold text-slate-900">Incoming referral queue</h2></div><div className="space-y-3">{referrals.map((referral) => <RoutineCard key={referral.id} referral={referral} activeOutcome={activeOutcome} outcome={outcome} onStatus={onStatus} onOpenOutcome={onOpenOutcome} onOutcome={onOutcome} />)}</div></section>;
}

function EmptyQueue() {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center" data-testid="hospital-empty-queue"><ClipboardCheck className="mx-auto text-slate-300" size={28} /><p className="mt-3 font-semibold text-slate-700">No incoming referrals yet</p></div>;
}

export default function HospitalOperations({ state }: { state: DemoState }) {
  const queryClient = useQueryClient();
  const [activeOutcome, setActiveOutcome] = useState("");
  const [outcome, setOutcome] = useState("");
  const routineReferrals = useMemo(() => state.referrals.filter((item) => !item.emergency), [state.referrals]);
  const referralById = useMemo(() => new Map(state.referrals.map((referral) => [referral.id, referral])), [state.referrals]);
  const emergencyItems = useMemo(() => state.emergencies.map((emergency) => ({ emergency, referral: emergency.referral_id ? referralById.get(emergency.referral_id) : undefined })), [state.emergencies, referralById]);
  const update = useMutation({ mutationFn: ({ id, status, nextOutcome }: { id: string; status: Status; nextOutcome?: string }) => apiPost<Referral>(`/referrals/${id}/status`, { status, outcome: nextOutcome }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["demo-state"] }); setActiveOutcome(""); setOutcome(""); toast.success("Referral status updated"); } });
  const onStatus: StatusHandler = (id, status, nextOutcome) => update.mutate({ id, status, nextOutcome });
  const openOutcome = (id: string) => { setActiveOutcome(id); setOutcome(""); };
  const empty = state.referrals.length === 0 && state.emergencies.length === 0;

  return <div className="space-y-6" data-testid="hospital-workspace"><QueueHeader /><EmergencyQueue items={emergencyItems} activeOutcome={activeOutcome} outcome={outcome} onStatus={onStatus} onOpenOutcome={openOutcome} onOutcome={setOutcome} /><RoutineQueue referrals={routineReferrals} activeOutcome={activeOutcome} outcome={outcome} onStatus={onStatus} onOpenOutcome={openOutcome} onOutcome={setOutcome} />{empty && <EmptyQueue />}</div>;
}