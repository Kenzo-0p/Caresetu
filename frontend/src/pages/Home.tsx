import { useQuery } from "@tanstack/react-query";
import { HeartPulse, LogOut, ShieldCheck, UsersRound } from "lucide-react";
import { Navigate } from "react-router-dom";

import DoctorWorkspace from "@/components/doctor/DoctorWorkspace";
import HospitalOperations from "@/components/HospitalOperations";
import PatientWorkspace from "@/components/patient/PatientWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { endSession } from "@/lib/session";
import type { DashboardState, SessionUser } from "@/types/domain";
import { EMPTY_STATE } from "@/types/domain";

function roleLabel(role: SessionUser["role"]) {
  if (role === "health_worker") return "Health Worker";
  if (role === "hospital_doctor") return "Hospital Doctor";
  if (role === "hospital_admin") return "Hospital Admin";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function Header({ user }: { user: SessionUser }) {
  return <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-teal-700 text-white shadow-sm"><HeartPulse size={22} /></div><div><div className="flex items-center gap-2"><span className="font-heading text-lg font-bold tracking-tight">CareSetu</span><span className="rounded-full bg-teal-50 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-teal-700">MVP</span></div><p className="text-[11px] text-slate-500">Secure healthcare access & referral</p></div></div><div className="flex items-center justify-between gap-2 sm:justify-end"><Badge className="border-teal-200 bg-teal-50 text-teal-700" data-testid="session-role-badge">{roleLabel(user.role)}</Badge><div className="hidden text-right md:block"><p className="text-xs font-semibold text-slate-700" data-testid="session-display-name">{user.display_name}</p><p className="text-[11px] text-slate-400">{user.email}</p></div><Button variant="outline" size="sm" onClick={() => endSession()} data-testid="logout-button"><LogOut size={14} /> Sign out</Button></div></div></header>;
}

function Workspace({ user, state }: { user: SessionUser; state: DashboardState }) {
  if (user.role === "patient") {
    if (!state.profile) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800" data-testid="patient-profile-missing">No patient record is linked to this account.</div>;
    return <PatientWorkspace state={{ ...state, profile: state.profile }} />;
  }
  if (user.role === "doctor" || user.role === "health_worker") return <DoctorWorkspace state={state} />;
  return <HospitalOperations state={state} role={user.role} />;
}

export default function Home() {
  const session = useQuery({ queryKey: ["session"], queryFn: () => apiGet<SessionUser>("/auth/me"), retry: false });
  const user = session.data;
  const dashboard = useQuery({ queryKey: ["dashboard", user?.role], queryFn: () => apiGet<DashboardState>("/dashboard"), enabled: Boolean(user), retry: false, refetchInterval: user?.role.startsWith("hospital_") ? 5000 : false });
  if (session.isLoading) return <main className="grid min-h-svh place-items-center bg-slate-50" data-testid="session-loading-state"><div className="size-10 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" /></main>;
  if (session.isError || !user) return <Navigate to="/login" replace />;
  const state = dashboard.data ?? EMPTY_STATE;

  let content;
  if (dashboard.isLoading) content = <div className="rounded-[24px] border border-slate-200 bg-white p-10" data-testid="workspace-loading-state"><div className="h-4 w-40 animate-pulse rounded bg-slate-100" /><div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-100" /></div>;
  else if (dashboard.isError) content = <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-6" data-testid="workspace-error-state"><p className="font-semibold text-amber-900">Your authorized workspace could not be loaded.</p><p className="mt-1 text-sm text-amber-800">Retry the secure dashboard request.</p><Button onClick={() => dashboard.refetch()} variant="outline" className="mt-4" data-testid="workspace-retry-button">Retry</Button></div>;
  else content = <Workspace user={user} state={state} />;

  return <main className="min-h-svh bg-[#f8fafc] text-slate-900" data-testid="caresetu-app"><Header user={user} /><div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs text-slate-500"><span className="size-2 rounded-full bg-emerald-500" />Authenticated demo · server-enforced role access</div><div className="flex items-center gap-2 text-xs text-slate-400"><UsersRound size={14} /> {state.referrals.length} referrals · {state.documents.length} documents</div></div>{content}</div><footer className="mx-auto flex max-w-[1440px] flex-col gap-2 border-t border-slate-200 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><span className="flex items-center gap-2"><ShieldCheck size={14} className="text-teal-600" /> Protected health data follows authenticated role and consent rules</span><span>For a real emergency, contact local emergency services.</span></footer></main>;
}