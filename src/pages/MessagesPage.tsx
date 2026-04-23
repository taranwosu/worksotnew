import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  MessageSquare,
  Loader2,
  Send,
  ArrowLeft,
  Inbox,
  Search as SearchIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type ConversationId = Id<"conversations">;

export function MessagesPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    id?: string;
    proposal?: string;
  };

  const conversations = useQuery(
    api.messages.listMyConversations,
    session ? {} : "skip"
  );
  const startFromProposal = useMutation(
    api.messages.startConversationFromProposal
  );

  const [selectedId, setSelectedId] = useState<ConversationId | null>(
    (search.id as ConversationId | undefined) ?? null
  );
  const [query, setQuery] = useState("");
  const didBootstrapProposalRef = useRef(false);

  // If ?proposal=<id> is provided, start/open that conversation once.
  useEffect(() => {
    if (!session || didBootstrapProposalRef.current) return;
    const proposalId = search.proposal;
    if (!proposalId) return;
    didBootstrapProposalRef.current = true;
    startFromProposal({ proposalId: proposalId as Id<"proposals"> })
      .then((conversationId) => {
        setSelectedId(conversationId);
        navigate({
          to: "/messages",
          search: { id: conversationId },
          replace: true,
        });
      })
      .catch((err) => console.error("Could not open conversation", err));
  }, [session, search.proposal, startFromProposal, navigate]);

  // If no selection yet, open the first conversation.
  useEffect(() => {
    if (selectedId) return;
    if (search.id) {
      setSelectedId(search.id as ConversationId);
      return;
    }
    if (conversations && conversations.length > 0) {
      setSelectedId(conversations[0]._id);
    }
  }, [conversations, selectedId, search.id]);

  const filtered = useMemo(() => {
    if (!conversations) return [];
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) =>
      c.otherUser.name.toLowerCase().includes(q) ||
      c.otherUser.email.toLowerCase().includes(q) ||
      c.lastMessagePreview.toLowerCase().includes(q)
    );
  }, [conversations, query]);

  if (isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-40" />
      </div>
    );
  }

  if (!session) {
    navigate({ to: "/signin" });
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Messages
        </h1>
        <p className="mt-1 text-sm text-ink-60">
          Talk directly with clients and experts about active projects.
        </p>
      </div>

      <div className="grid h-[calc(100vh-14rem)] min-h-[520px] grid-cols-1 gap-4 overflow-hidden rounded-lg border border-ink-12 bg-white shadow-sm lg:grid-cols-[340px_1fr]">
        {/* Conversation list */}
        <aside
          className={`flex flex-col border-ink-12 lg:border-r ${
            selectedId ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="border-b border-ink-12 p-3">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations"
                className="w-full rounded-lg border border-ink-12 bg-paper py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-40 focus:border-ink-20 focus:bg-white focus:outline-none focus:shadow-[0_0_0_3px_var(--color-sun-soft)]"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!conversations ? (
              <div className="p-4 space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-lg bg-cream-2"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyList hasConversations={conversations.length > 0} />
            ) : (
              <ul className="divide-y divide-ink-10">
                {filtered.map((c) => (
                  <li key={c._id}>
                    <button
                      onClick={() => {
                        setSelectedId(c._id);
                        navigate({
                          to: "/messages",
                          search: { id: c._id },
                          replace: true,
                        });
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-paper ${
                        selectedId === c._id ? "bg-paper" : ""
                      }`}
                    >
                      <Avatar
                        name={c.otherUser.name}
                        image={c.otherUser.image}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-ink">
                            {c.otherUser.name}
                          </p>
                          <span className="flex-shrink-0 text-[10px] font-medium uppercase tracking-wider text-ink-40">
                            {formatShortTime(c.lastMessageAt)}
                          </span>
                        </div>
                        <p
                          className={`mt-0.5 truncate text-xs ${
                            c.hasUnread
                              ? "font-semibold text-ink"
                              : "text-ink-60"
                          }`}
                        >
                          {c.lastMessagePreview || "No messages yet"}
                        </p>
                      </div>
                      {c.hasUnread && (
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-ink" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className={`flex flex-col ${selectedId ? "flex" : "hidden lg:flex"}`}>
          {selectedId ? (
            <ConversationThread
              conversationId={selectedId}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cream-2">
                  <MessageSquare className="h-5 w-5 text-ink-40" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-ink">
                  Select a conversation
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-60">
                  Pick a thread from the list to start chatting.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ConversationThread({
  conversationId,
  onBack,
}: {
  conversationId: ConversationId;
  onBack: () => void;
}) {
  const conversation = useQuery(api.messages.getConversation, {
    conversationId,
  });
  const messages = useQuery(api.messages.listMessages, { conversationId });
  const sendMessage = useMutation(api.messages.sendMessage);
  const markRead = useMutation(api.messages.markConversationRead);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastMarkedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!messages) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length, conversationId]);

  useEffect(() => {
    if (!conversation) return;
    const latest = messages?.[messages.length - 1];
    if (!latest) return;
    if (latest.createdAt <= lastMarkedAtRef.current) return;
    lastMarkedAtRef.current = latest.createdAt;
    markRead({ conversationId }).catch(() => {});
  }, [conversation, messages, conversationId, markRead]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendMessage({ conversationId, content: text });
      setDraft("");
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  if (conversation === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-ink-60">
        Conversation not found or you are not a participant.
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-ink-40" />
      </div>
    );
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-ink-12 px-4 py-3">
        <button
          onClick={onBack}
          className="rounded-md p-1.5 text-ink-60 hover:bg-cream-2 lg:hidden"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar
          name={conversation.otherUser.name}
          image={conversation.otherUser.image}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {conversation.otherUser.name}
          </p>
          {conversation.otherUser.email && (
            <p className="truncate text-xs text-ink-60">
              {conversation.otherUser.email}
            </p>
          )}
        </div>
        {conversation.relatedRequestId && (
          <span className="hidden rounded-full bg-sun/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink sm:inline-flex">
            Project thread
          </span>
        )}
      </header>

      <div
        ref={scrollerRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {!messages ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-10 w-3/5 animate-pulse rounded-lg bg-cream-2 ${
                  i % 2 ? "ml-auto" : ""
                }`}
              />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto h-5 w-5 text-cream/70" />
              <p className="mt-2 text-sm text-ink-60">
                Say hello to {conversation.otherUser.name.split(" ")[0]}.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const showTime =
              !prev || m.createdAt - prev.createdAt > 5 * 60 * 1000;
            return (
              <div key={m._id}>
                {showTime && (
                  <p className="my-3 text-center text-[10px] font-medium uppercase tracking-wider text-ink-40">
                    {formatFullTime(m.createdAt)}
                  </p>
                )}
                <div
                  className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3.5 py-2 text-sm shadow-sm ${
                      m.isMine
                        ? "bg-ink text-white"
                        : "border border-ink-12 bg-white text-ink"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={onSend}
        className="flex items-end gap-2 border-t border-ink-12 p-3"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Write a message…"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-ink-12 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-40 focus:border-ink-20 focus:outline-none focus:shadow-[0_0_0_3px_var(--color-sun-soft)]"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-ink px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:bg-ink-20"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send
        </button>
      </form>
    </>
  );
}

function EmptyList({ hasConversations }: { hasConversations: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-2">
        <Inbox className="h-4 w-4 text-ink-40" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-ink">
        {hasConversations ? "No matches" : "No conversations yet"}
      </h3>
      <p className="mx-auto mt-1 max-w-xs text-xs text-ink-60">
        {hasConversations
          ? "Try a different search term."
          : "Message a client or expert from a project or proposal to start a thread."}
      </p>
      {!hasConversations && (
        <Link
          to="/dashboard"
          className="mt-3 text-xs font-semibold text-ink hover:text-ink"
        >
          Go to dashboard →
        </Link>
      )}
    </div>
  );
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
      {initial}
    </div>
  );
}

function formatShortTime(ts: number): string {
  const now = Date.now();
  const diffMs = now - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatFullTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return time;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${time}`;
}
