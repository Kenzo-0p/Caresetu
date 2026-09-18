import { Check, CheckCircle2, ChevronRight, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { EventItem, Facility } from "@/types/domain";

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("emergency") || normalized.includes("ambulance")) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (["Accepted", "Outcome Updated", "verified"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "unreadable") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mb-5 flex items-start gap-3" data-testid={`${title.toLowerCase().replaceAll(" ", "-")}-section-heading`}>
      <div className="mt-1 rounded-xl bg-teal-50 p-2.5 text-teal-700"><Icon size={19} /></div>
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">{eyebrow}</p>
        <h2 className="font-heading text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export function FacilityCard({
  facility,
  selected,
  onSelect,
  emergency = false,
}: {
  facility: Facility;
  selected: boolean;
  onSelect: () => void;
  emergency?: boolean;
}) {
  const cardStyle = selected
    ? "border-teal-500 bg-teal-50/70 shadow-sm"
    : "border-slate-200 bg-white hover:border-teal-300";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${cardStyle}`}
      data-testid={`facility-${facility.id}-select`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading font-semibold text-slate-900">{facility.name}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} />{facility.location} · {facility.distance}</p>
        </div>
        {selected
          ? <CheckCircle2 className="text-teal-600" size={20} />
          : <ChevronRight className="text-slate-300 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-teal-600" size={20} />}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {facility.capabilities.map((capability) => {
          const emergencyStyle = emergency && capability === "Emergency"
            ? "bg-red-100 text-red-700"
            : "bg-slate-100 text-slate-600";
          return <span key={capability} className={`rounded-full px-2 py-1 text-[11px] font-medium ${emergencyStyle}`}>{capability}</span>;
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{facility.match_reason}</p>
    </button>
  );
}

export function Timeline({ events, testId = "referral-status-timeline" }: { events: EventItem[]; testId?: string }) {
  const sequence = ["Created", "Sent", "Received", "Accepted", "Rejected", "Redirected", "Arrived", "Outcome Updated"];
  const visible = events.filter((event) => sequence.includes(event.label));

  return (
    <div className="space-y-3" data-testid={testId}>
      {visible.map((event, index) => (
        <div className="flex gap-3" key={`${event.label}-${index}`}>
          <div className="flex flex-col items-center">
            <div className="grid size-6 place-items-center rounded-full bg-teal-100 text-teal-700"><Check size={13} strokeWidth={3} /></div>
            {index < visible.length - 1 && <div className="mt-1 h-5 w-px bg-teal-100" />}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-sm font-semibold text-slate-800">{event.label}</p>
            <p className="text-xs text-slate-500">{formatTime(event.timestamp)}{event.detail ? ` · ${event.detail}` : ""}</p>
          </div>
        </div>
      ))}
    </div>
  );
}