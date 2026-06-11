import { useState } from "react";
import { Mail, CheckCircle2, Inbox } from "lucide-react";
import { toast } from "sonner";
import {
  adminMarkContactHandled,
  type ContactSubmission,
} from "@/lib/api";
import { Button, Tag } from "@/components/primitives";
import { cn } from "@/lib/utils";

const TOPIC_LABELS: Record<ContactSubmission["topic"], string> = {
  managed: "Managed service",
  general: "General",
  bench: "Bench / enterprise",
  apply: "Contractor",
  press: "Press",
};

export function AdminLeadsTab({
  leads,
  onChanged,
}: {
  leads: ContactSubmission[];
  onChanged: () => void;
}) {
  const [topic, setTopic] = useState<"all" | ContactSubmission["topic"]>("all");
  const [showHandled, setShowHandled] = useState(false);

  const filtered = leads.filter(
    (l) =>
      (topic === "all" || l.topic === topic) &&
      (showHandled || !l.handled),
  );
  const countFor = (t: "all" | ContactSubmission["topic"]) =>
    leads.filter((l) => !l.handled && (t === "all" || l.topic === t)).length;

  return (
    <div data-testid="admin-leads-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "managed", "general", "bench", "apply", "press"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              data-testid={`leads-filter-${t}`}
              className={cn(
                "rounded-pill border px-3 py-1.5 text-[12px] font-medium transition-colors",
                topic === t
                  ? "border-sun bg-sun/15 text-cream"
                  : "border-cream/15 text-cream/60 hover:border-cream/40 hover:text-cream",
              )}
            >
              {t === "all" ? "All" : TOPIC_LABELS[t]}
              {countFor(t) > 0 && (
                <span className="ml-1.5 font-mono text-[10.5px] text-sun">{countFor(t)}</span>
              )}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-cream/60">
          <input
            type="checkbox"
            checked={showHandled}
            onChange={(e) => setShowHandled(e.target.checked)}
            data-testid="leads-show-handled"
            className="h-3.5 w-3.5 accent-[#FFB51F]"
          />
          Show handled
        </label>
      </div>

      <div className="mt-5 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded border border-cream/10 p-10 text-center">
            <Inbox className="h-6 w-6 text-cream/30" />
            <p className="text-[13px] text-cream/60">
              {showHandled ? "No leads in this view." : "Inbox zero — no unhandled leads."}
            </p>
          </div>
        ) : (
          filtered.map((l) => <LeadCard key={l.id} lead={l} onChanged={onChanged} />)
        )}
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  onChanged,
}: {
  lead: ContactSubmission;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const markHandled = async () => {
    setBusy(true);
    try {
      await adminMarkContactHandled(lead.id);
      toast.success("Lead marked handled");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const mailto = `mailto:${lead.email}?subject=${encodeURIComponent(
    `Re: your WorkSoy ${TOPIC_LABELS[lead.topic].toLowerCase()} enquiry`,
  )}`;

  return (
    <div
      className={cn(
        "rounded border bg-ink-2 p-5",
        lead.handled ? "border-cream/10 opacity-60" : "border-cream/15",
      )}
      data-testid={`lead-${lead.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[14px] font-semibold text-cream">
            {lead.name}
            <span className="ml-2 font-sans text-[12px] font-normal text-cream/60">
              {lead.email}
              {lead.company ? ` · ${lead.company}` : ""}
            </span>
          </p>
          <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-cream/40">
            {new Date(lead.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tag tone={lead.topic === "managed" ? "sun" : "outline"} size="sm">
            {TOPIC_LABELS[lead.topic]}
          </Tag>
          {lead.handled && <Tag tone="moss" size="sm">Handled</Tag>}
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-cream/80">
        {lead.message}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-cream/10 pt-4">
        <a
          href={mailto}
          data-testid={`lead-reply-${lead.id}`}
          className="inline-flex items-center gap-1.5 rounded border border-cream/20 px-3 py-1.5 text-[12px] font-medium text-cream transition-colors hover:bg-cream/10"
        >
          <Mail className="h-3.5 w-3.5" /> Reply by email
        </a>
        {!lead.handled && (
          <Button
            tone="sun"
            size="sm"
            disabled={busy}
            onClick={markHandled}
            data-testid={`lead-handle-${lead.id}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Mark handled
          </Button>
        )}
      </div>
    </div>
  );
}
