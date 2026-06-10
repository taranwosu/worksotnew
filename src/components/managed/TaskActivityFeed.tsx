import { useState } from "react";
import { Loader2, Send, Lock, ArrowRight, Package, UserPlus } from "lucide-react";
import type { ManagedTaskEvent } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  queued: "Queued",
  accepted: "Queued",
  assigned: "Assigned",
  in_progress: "In progress",
  submitted: "Needs review",
  revision_requested: "Revision requested",
  delivered: "Delivered",
  completed: "Completed",
  on_hold: "On hold",
  cancelled: "Cancelled",
};

function fmt(at: string) {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskActivityFeed({
  events,
  theme = "cream",
  canPostInternal = false,
  onPost,
}: {
  events: ManagedTaskEvent[];
  theme?: "ink" | "cream";
  canPostInternal?: boolean;
  onPost?: (body: string, visibility: "client" | "internal") => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const dark = theme === "ink";

  const muted = dark ? "text-cream/50" : "text-ink-40";
  const text = dark ? "text-cream/90" : "text-ink";
  const border = dark ? "border-cream/10" : "border-ink-12";
  const inputCls = dark
    ? "border-cream/15 bg-ink-2 text-cream placeholder:text-cream/40"
    : "border-ink-20 bg-white text-ink placeholder:text-ink-40";

  const submit = async () => {
    if (!body.trim() || !onPost) return;
    setBusy(true);
    try {
      await onPost(body.trim(), internal ? "internal" : "client");
      setBody("");
      setInternal(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="task-activity-feed">
      <div className="space-y-3">
        {events.length === 0 && (
          <p className={cn("text-[12.5px]", muted)}>No activity yet.</p>
        )}
        {events.map((e) => {
          const isInternal = e.visibility === "internal";
          if (e.kind === "comment") {
            return (
              <div key={e.id} className={cn("rounded border p-3", border, isInternal && "border-dashed")}>
                <div className={cn("flex items-center justify-between text-[11px]", muted)}>
                  <span className="font-semibold">{e.author_name}</span>
                  <span className="flex items-center gap-2">
                    {isInternal && (
                      <span className="inline-flex items-center gap-1 font-mono uppercase tracking-[0.1em]">
                        <Lock className="h-3 w-3" /> internal
                      </span>
                    )}
                    {fmt(e.created_at)}
                  </span>
                </div>
                <p className={cn("mt-1.5 whitespace-pre-wrap text-[13px]", text)}>{e.body}</p>
              </div>
            );
          }
          return (
            <div key={e.id} className={cn("flex items-center gap-2 px-1 text-[12px]", muted)}>
              {e.kind === "assignment" ? (
                <UserPlus className="h-3.5 w-3.5 shrink-0" />
              ) : e.kind === "deliverable" ? (
                <Package className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="min-w-0">
                {e.kind === "status_change" && e.meta?.to_status ? (
                  <>
                    {e.author_name} moved this to{" "}
                    <span className="font-semibold">
                      {STATUS_LABELS[e.meta.to_status] ?? e.meta.to_status}
                    </span>
                    {e.body ? <> — {e.body}</> : null}
                  </>
                ) : (
                  <>
                    {e.author_name}
                    {e.body ? <> — {e.body}</> : null}
                  </>
                )}
                {isInternal && (
                  <span className="ml-1.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em]">
                    <Lock className="h-2.5 w-2.5" /> internal
                  </span>
                )}
              </span>
              <span className="ml-auto shrink-0">{fmt(e.created_at)}</span>
            </div>
          );
        })}
      </div>

      {onPost && (
        <div className="mt-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Write a comment…"
            data-testid="task-comment-input"
            className={cn("w-full rounded border px-3 py-2 text-[13px] focus:outline-none", inputCls)}
          />
          <div className="mt-2 flex items-center justify-between">
            {canPostInternal ? (
              <label className={cn("flex items-center gap-2 text-[12px]", muted)}>
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  data-testid="task-comment-internal"
                />
                Internal note (hidden from client)
              </label>
            ) : (
              <span />
            )}
            <button
              onClick={submit}
              disabled={busy || !body.trim()}
              data-testid="task-comment-send"
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded px-3.5 text-[13px] font-semibold disabled:opacity-50",
                dark ? "bg-sun text-ink hover:bg-[#FFB51F]" : "bg-ink text-cream hover:bg-ink-2",
              )}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
