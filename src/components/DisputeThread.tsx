import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Paperclip, FileText, ShieldCheck, CheckCircle2 } from "lucide-react";
import {
  getDispute,
  getDisputeMessages,
  postDisputeMessage,
  uploadFile,
  fileDownloadUrl,
  adminResolveDispute,
  type Dispute,
  type DisputeMessage,
} from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { Button, Tag } from "@/components/primitives";
import { cn } from "@/lib/utils";

type Props = {
  disputeId: string;
  onResolved?: () => void;
  onDispute?: (d: Dispute) => void;
  theme?: "cream" | "ink"; // "ink" styles for admin console
};

export function DisputeThread({ disputeId, onResolved, onDispute, theme = "cream" }: Props) {
  const { data: session } = useSession();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resolving, setResolving] = useState<null | "release" | "refund">(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const isAdmin = session?.user.role === "admin";
  const darkMode = theme === "ink";

  const load = async () => {
    setLoading(true);
    try {
      const [d, m] = await Promise.all([
        getDispute(disputeId),
        getDisputeMessages(disputeId),
      ]);
      setDispute(d);
      setMessages(m);
      onDispute?.(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [disputeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      const m = await postDisputeMessage(disputeId, draft.trim());
      setMessages((p) => [...p, m]);
      setDraft("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const meta = await uploadFile(file, { dispute_id: disputeId });
      const m = await postDisputeMessage(disputeId, `📎 ${meta.filename}`, meta.id);
      setMessages((p) => [...p, m]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleResolve = async (action: "release" | "refund") => {
    if (!dispute) return;
    const note = window.prompt(`Resolution note for ${action} (optional):`) ?? undefined;
    setResolving(action);
    try {
      await adminResolveDispute(disputeId, action, note || undefined);
      await load();
      onResolved?.();
    } finally {
      setResolving(null);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-10", darkMode ? "text-cream/60" : "text-ink-60")}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!dispute) {
    return <p className={cn("text-[13px]", darkMode ? "text-cream/60" : "text-ink-60")}>Dispute unavailable.</p>;
  }

  const resolved = dispute.status === "resolved";

  return (
    <div className={cn("overflow-hidden rounded border", darkMode ? "border-cream/10 bg-ink-2" : "border-ink-12 bg-white")}>
      {/* Header */}
      <div className={cn("flex items-start justify-between gap-4 border-b px-5 py-4", darkMode ? "border-cream/10" : "border-ink-10")}>
        <div className="min-w-0">
          <p className={cn("font-mono text-[10.5px] uppercase tracking-[0.14em]", darkMode ? "text-cream/60" : "text-ink-60")}>
            Dispute · opened by {dispute.opened_by_name}
          </p>
          <p className={cn("mt-0.5 text-[12.5px]", darkMode ? "text-cream/70" : "text-ink-60")}>
            Filed {new Date(dispute.created_at).toLocaleString()}
          </p>
        </div>
        <Tag tone={resolved ? "outline" : "sun"} size="sm">{dispute.status}</Tag>
      </div>

      {/* Original reason always pinned at top */}
      <div className={cn("border-b px-5 py-4", darkMode ? "border-cream/10 bg-ink-3/40" : "border-ink-10 bg-cream-2/40")}>
        <p className={cn("font-mono text-[10.5px] uppercase tracking-[0.14em]", darkMode ? "text-cream/60" : "text-ink-60")}>
          Original claim
        </p>
        <p className={cn("mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed", darkMode ? "text-cream" : "text-ink")}>
          {dispute.reason}
        </p>
      </div>

      {/* Resolution banner */}
      {resolved && (
        <div className={cn("flex items-start gap-2 border-b px-5 py-3", darkMode ? "border-cream/10 bg-sun/10 text-cream" : "border-ink-10 bg-sun/15 text-ink")}>
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-sun-2" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">{dispute.resolution_action?.toUpperCase()} — {dispute.resolution}</p>
            {dispute.resolution_note && (
              <p className={cn("mt-0.5 text-[12.5px]", darkMode ? "text-cream/70" : "text-ink-60")}>{dispute.resolution_note}</p>
            )}
          </div>
        </div>
      )}

      {/* Thread */}
      <div className={cn("max-h-[420px] space-y-3 overflow-y-auto px-5 py-4", darkMode ? "bg-ink-2" : "bg-white")}>
        {messages.length === 0 ? (
          <p className={cn("py-6 text-center text-[13px]", darkMode ? "text-cream/60" : "text-ink-60")}>
            No responses yet — add context or evidence to move this forward.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_user_id === session?.user._id;
            const roleTone = m.sender_role === "admin" ? "sun" : m.sender_role === "client" ? "ink" : "outline";
            return (
              <div key={m.id} className={cn("flex", mine && "justify-end")}>
                <div className={cn("max-w-[80%] rounded-lg border px-3.5 py-2 text-[13.5px]",
                  mine
                    ? (darkMode ? "border-cream/20 bg-ink" : "border-ink bg-ink text-cream")
                    : (darkMode ? "border-cream/10 bg-ink-3 text-cream" : "border-ink-10 bg-cream-2 text-ink"),
                )}>
                  <div className="mb-1 flex items-center gap-2 text-[10.5px]">
                    <span className={cn("font-semibold", mine ? (darkMode ? "text-cream" : "text-cream") : (darkMode ? "text-cream/80" : "text-ink"))}>
                      {m.sender_name}
                    </span>
                    <Tag tone={roleTone} size="sm">{m.sender_role === "admin" && <ShieldCheck className="mr-1 inline h-3 w-3" />}{m.sender_role}</Tag>
                  </div>
                  {m.file_id ? (
                    <a
                      href={fileDownloadUrl(m.file_id)}
                      target="_blank"
                      rel="noreferrer"
                      className={cn("flex items-center gap-2 rounded border px-2.5 py-1.5",
                        mine ? "border-cream/20 text-cream hover:bg-ink-2" : (darkMode ? "border-cream/15 text-cream" : "border-ink-10 text-ink hover:border-ink"),
                      )}
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{m.file_name ?? "file"}</p>
                        {m.file_size ? (
                          <p className={cn("font-mono text-[11px]", mine ? "opacity-70" : (darkMode ? "text-cream/60" : "text-ink-60"))}>
                            {(m.file_size / 1024).toFixed(1)} KB
                          </p>
                        ) : null}
                      </div>
                    </a>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Compose + admin actions */}
      {!resolved && (
        <div className={cn("border-t", darkMode ? "border-cream/10" : "border-ink-10")}>
          <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3">
            <input ref={fileInputRef} type="file" onChange={handleAttach} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              data-testid="dispute-attach"
              className={cn("inline-flex h-10 w-10 items-center justify-center rounded border",
                darkMode ? "border-cream/20 text-cream hover:bg-cream/10" : "border-ink-20 bg-white text-ink hover:border-ink",
                uploading && "opacity-50",
              )}
              aria-label="Attach evidence"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a response or context…"
              data-testid="dispute-compose"
              className={cn("h-10 flex-1 rounded border px-3 text-[14px] focus:outline-none",
                darkMode ? "border-cream/20 bg-ink-3 text-cream placeholder:text-cream/40 focus:border-cream" : "border-ink-20 bg-cream-2 text-ink placeholder:text-ink-40 focus:border-ink",
              )}
            />
            <button
              type="submit"
              data-testid="dispute-send"
              disabled={sending || !draft.trim()}
              className={cn("inline-flex h-10 items-center gap-1.5 rounded px-4 text-[13px] font-semibold disabled:opacity-50",
                darkMode ? "bg-sun text-ink" : "bg-ink text-cream",
              )}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </form>
          {isAdmin && (
            <div className={cn("flex gap-2 border-t px-4 py-3", darkMode ? "border-cream/10" : "border-ink-10")}>
              <Button
                tone="sun"
                size="sm"
                onClick={() => handleResolve("release")}
                disabled={resolving !== null}
                data-testid={`dispute-resolve-release`}
              >
                {resolving === "release" ? "Releasing…" : "Release to expert"}
              </Button>
              <Button
                tone="outline"
                size="sm"
                onClick={() => handleResolve("refund")}
                disabled={resolving !== null}
                data-testid={`dispute-resolve-refund`}
              >
                {resolving === "refund" ? "Refunding…" : "Refund client"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
