import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, HeartPulse, Hospital, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import type { SessionUser } from "@/types/domain";

const accounts = [
  { role: "Patient", email: "patient@caresetu.demo", icon: UserRound },
  { role: "Doctor", email: "doctor@caresetu.demo", icon: Stethoscope },
  { role: "Health Worker", email: "worker@caresetu.demo", icon: Stethoscope },
  { role: "Hospital Doctor", email: "hospital.doctor@caresetu.demo", icon: Hospital },
  { role: "Hospital Admin", email: "hospital.admin@caresetu.demo", icon: Hospital },
];

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.body && typeof error.body === "object" && "detail" in error.body) {
    return String(error.body.detail);
  }
  return "Sign-in failed. Check the demo credentials and try again.";
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("patient@caresetu.demo");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => apiPost<SessionUser>("/auth/login", { email, password }),
    onSuccess: () => { beginSession(); navigate("/", { replace: true }); },
  });

  return (
    <main className="min-h-svh bg-[#f8fafc] px-4 py-8 text-slate-900 sm:py-14" data-testid="login-page">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative overflow-hidden rounded-[30px] bg-teal-800 p-7 text-white sm:p-10" data-testid="login-brand-panel">
          <div className="absolute -right-16 -top-20 size-72 rounded-full bg-teal-500/20" />
          <div className="relative"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-white/15"><HeartPulse size={24} /></div><div><p className="font-heading text-2xl font-bold">CareSetu</p><p className="text-xs text-teal-100">Secure healthcare access & referral</p></div></div><Badge className="mt-10 border-teal-400/30 bg-teal-950/20 text-teal-50">AUTHENTICATED MVP</Badge><h1 className="mt-5 max-w-lg font-heading text-4xl font-bold leading-tight">One patient identity. The right care context.</h1><p className="mt-4 max-w-lg leading-relaxed text-teal-100/80">Patient Code, secure QR and normalized phone lookup all resolve to one protected patient record. Medical context opens only after authorization.</p><div className="mt-10 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/15 bg-white/10 p-4"><ShieldCheck size={20} /><p className="mt-2 text-sm font-semibold">Server-enforced roles</p><p className="mt-1 text-xs text-teal-100/70">Patient, provider and hospital permissions are checked on every route.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 p-4"><UserRound size={20} /><p className="mt-2 text-sm font-semibold">Consent before history</p><p className="mt-1 text-xs text-teal-100/70">Identification never unlocks protected clinical data by itself.</p></div></div></div>
        </section>
        <Card className="self-center border-slate-200 shadow-[0_24px_70px_-35px_rgba(15,23,42,.3)]" data-testid="login-card">
          <CardHeader><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">DEMO ACCESS</p><CardTitle className="font-heading text-2xl">Sign in to your workspace</CardTitle><p className="text-sm text-slate-500">Choose an account, then enter its seeded demo password.</p></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="demo-account-options">{accounts.map((account) => { const Icon = account.icon; const selected = email === account.email; return <button type="button" key={account.email} onClick={() => { setEmail(account.email); setPassword(""); login.reset(); }} className={`rounded-xl border p-3 text-left transition-colors duration-150 ${selected ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white hover:border-teal-300"}`} data-testid={`login-account-${account.role.toLowerCase().replaceAll(" ", "-")}`}><Icon size={17} className={selected ? "text-teal-700" : "text-slate-400"} /><p className="mt-2 text-xs font-semibold text-slate-800">{account.role}</p></button>; })}</div>
            <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); login.mutate(); }} data-testid="login-form"><label className="block text-xs font-semibold text-slate-600">Email<Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="mt-1" data-testid="login-email-input" /></label><label className="block text-xs font-semibold text-slate-600">Password<Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Enter seeded password" className="mt-1" data-testid="login-password-input" /></label>{login.isError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="login-error-message">{errorMessage(login.error)}</div>}<Button type="submit" disabled={login.isPending || password.length < 8} className="w-full bg-teal-700 hover:bg-teal-800" data-testid="login-submit-button">{login.isPending ? "Signing in…" : "Sign in securely"}<ArrowRight size={16} /></Button></form>
            <p className="mt-4 text-xs leading-relaxed text-slate-400">Synthetic demo accounts only. Credentials are listed in the engineering handoff and are not production identity policy.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}