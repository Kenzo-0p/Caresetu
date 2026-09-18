import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, ClipboardCheck, Siren } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api";

interface EventItem { label: string; timestamp: string; detail?: string | null }
interface Referral { id: string; patient_name: string; facility_name: string; reason: string; care_requirement: string; status: string; emergency: boolean; events: EventItem[] }
interface EmergencyEvent { id: string; patient_name: string; status: string; dispatch_status: string; referral_id?: string | null; created_at: string }
interface HospitalState { referrals: Referral[]; emergencies: EmergencyEvent[] }
type Status = "Accepted" | "Rejected" | "Redirected" | "Arrived" | "Outcome Updated";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(value));
}

function Timeline({ events }: { events: EventItem[] }) {
  return <div className="space-y-2" data-testid="hospital-referral-timeline">{events.map((event, index) => <div key={`${event.label}-${index}`} className="flex gap-3"><div className="grid size-6 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-700"><Check size={13} /></div><div><p className="text-sm font-semibold text-slate-800">{event.label}</p><p className="text-xs text-slate-500">{formatTime(event.timestamp)}{event.detail ? ` · ${event.detail}` : ""}</p></div></div>)}</div>;
}

export default function HospitalOperations({ state }: { state: HospitalState }) {
  const queryClient = useQueryClient();
  const [outcomeFor, setOutcomeFor] = useState("");
  const [outcomeText, setOutcomeText] = useState("");
  const updateStatus = useMutation({
    mutationFn: ({ id, status, outcome }: { id: string; status: Status; outcome?: string }) => apiPost<Referral>(`/referrals/${id}/status`, { status, outcome }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["demo-state"] }); setOutcomeFor(""); setOutcomeText(""); toast.success("Referral status updated"); },
  });
  const routine = state.referrals.filter((item) => !item.emergency);

  function actions(referral: Referral, prefix: string) {
    if (referral.status === "Sent") return <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => updateStatus.mutate({ id: referral.id, status: "Accepted" })} className="bg-teal-700 hover:bg-teal-800" data-testid={`${prefix}-accept-button`}>Accept</Button><Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: referral.id, status: "Redirected" })} data-testid={`${prefix}-redirect-button`}>Redirect</Button><Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: referral.id, status: "Rejected" })} data-testid={`${prefix}-reject-button`}>Reject</Button></div>;
    if (referral.status === "Accepted") return <Button size="sm" onClick={() => updateStatus.mutate({ id: referral.id, status: "Arrived" })} className="bg-teal-700 hover:bg-teal-800" data-testid={`${prefix}-arrived-button`}>Mark arrived</Button>;
    if (referral.status === "Arrived") return <Button size="sm" variant="outline" onClick={() => setOutcomeFor(referral.id)} data-testid={`${prefix}-outcome-button`}>Update outcome</Button>;
    return <Badge className="border-slate-200 bg-slate-50 text-slate-600">{referral.status}</Badge>;
  }

  function outcomeForm(referral: Referral, prefix: string) {
    if (outcomeFor !== referral.id) return null;
    return <div className="mt-3 flex gap-2"><Input value={outcomeText} onChange={(event) => setOutcomeText(event.target.value)} placeholder="Outcome note" data-testid={`${prefix}-outcome-input`} /><Button size="sm" disabled={!outcomeText} onClick={() => updateStatus.mutate({ id: referral.id, status: "Outcome Updated", outcome: outcomeText })} data-testid={`${prefix}-outcome-save-button`}>Save outcome</Button></div>;
  }

  return <div className="space-y-6" data-testid="hospital-workspace">
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm" data-testid="hospital-queue-header"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-center"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">HOSPITAL OPERATIONS · SHARED DEMO QUEUE</p><h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-950">Incoming care, clearly prioritized.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Emergency items stay above routine referrals. Stored queue state remains usable even without realtime delivery.</p></div><div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><BellRing size={15} className="text-teal-700" /> Database-backed queue</div></div></section>
    {state.emergencies.length > 0 && <section data-testid="hospital-emergency-queue"><div className="mb-3"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-red-700">EMERGENCY FAST LANE</p><h2 className="font-heading text-xl font-semibold text-slate-900">{state.emergencies.length} emergency event{state.emergencies.length > 1 ? "s" : ""}</h2></div><div className="space-y-3">{state.emergencies.map((emergency) => { const referral = state.referrals.find((item) => item.id === emergency.referral_id); const prefix = `emergency-${emergency.id}`; return <article key={emergency.id} className="rounded-[22px] border-2 border-red-200 bg-red-50 p-5" data-testid={`${prefix}-card`}><div className="flex flex-col justify-between gap-4 lg:flex-row"><div className="flex gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-600 text-white"><Siren size={22} /></div><div><p className="font-mono text-[10px] font-bold tracking-[0.16em] text-red-700">INCOMING EMERGENCY PATIENT</p><h3 className="mt-1 font-heading text-lg font-semibold text-slate-900">{emergency.patient_name}</h3><p className="mt-1 text-sm text-red-900/70">{emergency.status} · {emergency.dispatch_status} · {formatTime(emergency.created_at)}</p><p className="mt-3 text-sm text-slate-700">Emergency-only summary first. Break-glass access is limited and audited.</p></div></div>{referral && actions(referral, prefix)}</div>{referral && <div className="mt-4 border-t border-red-200 pt-4"><p className="text-sm font-medium text-slate-800">{referral.facility_name} · {referral.status}</p>{outcomeForm(referral, prefix)}</div>}</article>; })}</div></section>}
    {routine.length > 0 && <section data-testid="hospital-referral-queue"><div className="mb-3"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">NORMAL REFERRALS</p><h2 className="font-heading text-xl font-semibold text-slate-900">Incoming referral queue</h2></div><div className="space-y-3">{routine.map((referral) => { const prefix = `referral-${referral.id}`; return <article key={referral.id} className="rounded-2xl border border-slate-200 bg-white p-4" data-testid={`${prefix}-queue-card`}><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h3 className="font-heading font-semibold text-slate-900">{referral.patient_name}</h3><p className="mt-1 text-sm text-slate-500">{referral.facility_name} · {referral.care_requirement}</p><p className="mt-2 text-xs text-slate-600">{referral.reason}</p></div>{actions(referral, prefix)}</div>{outcomeForm(referral, prefix)}<div className="mt-4 border-t border-slate-100 pt-4"><Timeline events={referral.events} /></div></article>; })}</div></section>}
    {state.referrals.length === 0 && state.emergencies.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center" data-testid="hospital-empty-queue"><ClipboardCheck className="mx-auto text-slate-300" size={28} /><p className="mt-3 font-semibold text-slate-700">No incoming referrals yet</p></div>}
  </div>;
}