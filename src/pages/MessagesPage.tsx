import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Send } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { listConversations, listMessages, sendMessage, type ConversationSummary, type Message } from "@/lib/api";
import { Container, Eyebrow, Tag } from "@/components/primitives";
import { cn } from "@/lib/utils";

export function MessagesPage() {
  const { data: session } = useSession();
  const [convs, setConvs] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listConversations()
      .then((c) => {
        setConvs(c);
        if (c.length > 0) setActiveId(c[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    listMessages(activeId).then(setMsgs).catch(() => setMsgs([]));
  }, [activeId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  if (!session) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-40" /></div>;
  }

  const active = convs.find((c) => c.id === activeId);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !draft.trim()) return;
    setSending(true);
    try {
      const m = await sendMessage(activeId, draft.trim());
      setMsgs((prev) => [...prev, m]);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-cream pb-16 pt-16 md:pt-20">
      <Container>
        <Eyebrow index="§ 05" accent>Inbox</Eyebrow>
        <h1 className="mt-3 font-display text-[clamp(2rem,4vw,2.75rem)] font-medium tracking-[-0.02em] text-ink">
          Messages
        </h1>

        <div className="mt-8 grid gap-4 md:grid-cols-[320px_1fr]">
          <aside className="overflow-hidden rounded border border-ink-12 bg-white">
            {loading ? (
              <div className="p-6 text-center text-[13px] text-ink-60">Loading…</div>
            ) : convs.length === 0 ? (
              <div className="p-6 text-[13px] text-ink-60">No conversations yet. They start automatically when a proposal is accepted.</div>
            ) : (
              convs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-ink-10 px-4 py-3 text-left last:border-0",
                    activeId === c.id ? "bg-cream-2" : "hover:bg-cream-2/60",
                  )}
                >
                  {c.other_user_image ? (
                    <img src={c.other_user_image} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-cream">
                      {c.other_user_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center justify-between text-[14px] font-semibold text-ink">
                      <span className="truncate">{c.other_user_name}</span>
                      {c.unread > 0 && <Tag tone="sun" size="sm">{c.unread}</Tag>}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-60">{c.last_body || c.brief_title}</p>
                  </div>
                </button>
              ))
            )}
          </aside>

          <section className="flex min-h-[60vh] flex-col overflow-hidden rounded border border-ink-12 bg-white">
            {active ? (
              <>
                <header className="flex items-center justify-between border-b border-ink-10 px-5 py-4">
                  <div>
                    <p className="font-display text-[16px] font-semibold text-ink">{active.other_user_name}</p>
                    {active.brief_title && (
                      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-60">
                        Re: {active.brief_title}
                      </p>
                    )}
                  </div>
                  {active.brief_id && (
                    <Link to="/briefs/$briefId" params={{ briefId: active.brief_id }} className="text-[12px] font-semibold text-ink underline">
                      Open brief
                    </Link>
                  )}
                </header>
                <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {msgs.map((m) => {
                    const mine = m.sender_user_id === session.user._id;
                    return (
                      <div key={m.id} className={cn("flex", mine && "justify-end")}>
                        <div className={cn(
                          "max-w-[70%] rounded-lg px-3.5 py-2 text-[14px]",
                          mine ? "bg-ink text-cream" : "bg-cream-2 text-ink",
                        )}>
                          {m.body}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-ink-10 px-4 py-3">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a message…"
                    className="h-10 flex-1 rounded border border-ink-20 bg-cream-2 px-3 text-[14px] text-ink placeholder:text-ink-40 focus:border-ink focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="inline-flex h-10 items-center gap-1.5 rounded bg-ink px-4 text-[13px] font-semibold text-cream disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-[13px] text-ink-60">
                Pick a conversation to start.
              </div>
            )}
          </section>
        </div>
      </Container>
    </div>
  );
}
