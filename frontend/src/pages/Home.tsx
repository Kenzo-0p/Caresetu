import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HeartPulse, Hospital, ShieldCheck, Stethoscope, UserRound, UsersRound } from "lucide-react";

import DoctorWorkspace from "@/components/doctor/DoctorWorkspace";
import HospitalOperations from "@/components/HospitalOperations";
import PatientWorkspace from "@/components/patient/PatientWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import type { DemoState, Role } from "@/types/domain";
import { EMPTY_STATE } from "@/types/domain";

const roleMeta = {
  patient: { label: "Patient", description: "Personal health journey", icon: UserRound },
  doctor: { label: "Doctor / Health Worker", description: "Clinical review & referral", icon: Stethoscope },
  hospital: { label: "Hospital Operations", description: "Incoming referral queue", icon: Hospital },
} satisfies Record<Role, { label: string; description: string; icon: typeof UserRound }>;

function RoleSwitcher({ role, onChange }: { role: Role; onChange: (role: Role) => void }) {
  return (
    <nav className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1" aria-label="Choose demo role" data-testid="role-switcher">
      {(Object.keys(roleMeta) as Role[]).map((key) => {
        const ItemIcon = roleMeta[key].icon;
        const activeStyle = role === key ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800";
        return (
          <button type="button" key={key} onClick={() => onChange(key)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-150 ${activeStyle}`} data-testid={`role-${key}-button`}>
            <ItemIcon size={14} />{roleMeta[key].label}
          </button>
        );
      })}
    </nav>
  );
}

function Header({ role, onRoleChange }: { role: Role; onRoleChange: (role: Role) => void }) {
  const meta = roleMeta[role];
  const RoleIcon = meta.icon;
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-teal-700 text-white shadow-sm"><HeartPulse size={22} /></div>
            <div>
              <div className="flex items-center gap-2"><span className="font-heading text-lg font-bold tracking-tight">CareSetu</span><span className="rounded-full bg-teal-50 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-teal-700">DEMO</span></div>
              <p className="text-[11px] text-slate-500">A calm healthcare coordinator</p>
            </div>
          </div>
          <Badge className="border-amber-200 bg-amber-50 text-amber-800 lg:hidden">SIMULATED DEMO</Badge>
        </div>
        <RoleSwitcher role={role} onChange={onRoleChange} />
        <div className="hidden items-center gap-2 lg:flex">
          <Badge className="border-amber-200 bg-amber-50 text-amber-800">DETERMINISTIC DEMO ADAPTERS</Badge>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3 text-xs text-slate-500"><RoleIcon size={15} className="text-teal-700" />{meta.description}</div>
        </div>
      </div>
    </header>
  );
}

function Workspace({ role, state }: { role: Role; state: DemoState }) {
  if (role === "patient") return <PatientWorkspace state={state} />;
  if (role === "doctor") return <DoctorWorkspace state={state} />;
  return <HospitalOperations state={state} />;
}

export default function Home() {
  const [role, setRole] = useState<Role>("patient");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["demo-state"],
    queryFn: () => apiGet<DemoState>("/demo/state"),
    retry: false,
  });
  const state = data ?? EMPTY_STATE;

  let content;
  if (isLoading) {
    content = <div className="rounded-[24px] border border-slate-200 bg-white p-10" data-testid="workspace-loading-state"><div className="h-4 w-40 animate-pulse rounded bg-slate-100" /><div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-100" /></div>;
  } else if (isError) {
    content = <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-6" data-testid="workspace-error-state"><p className="font-semibold text-amber-900">Some demo data could not be loaded.</p><p className="mt-1 text-sm text-amber-800">The shell remains available. Try the connection again.</p><Button onClick={() => refetch()} variant="outline" className="mt-4" data-testid="workspace-retry-button">Retry</Button></div>;
  } else {
    content = <Workspace role={role} state={state} />;
  }

  return (
    <main className="min-h-svh bg-[#f8fafc] text-slate-900" data-testid="caresetu-app">
      <Header role={role} onRoleChange={setRole} />
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500"><span className="size-2 rounded-full bg-emerald-500" />Demo environment · no real clinical or ambulance service connected</div>
          <div className="flex items-center gap-2 text-xs text-slate-400"><UsersRound size={14} /> {state.referrals.length} referrals · {state.documents.length} documents</div>
        </div>
        {content}
      </div>
      <footer className="mx-auto flex max-w-[1440px] flex-col gap-2 border-t border-slate-200 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-teal-600" /> Assistance is unverified until a clinician reviews it</span>
        <span>For a real emergency, contact local emergency services.</span>
      </footer>
    </main>
  );
}