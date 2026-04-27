import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, X } from "lucide-react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadCount,
  type Notification,
} from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const POLL_MS = 30000;

export function NotificationsBell() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchCount = () => {
    if (!session) return;
    unreadCount()
      .then((r) => setCount(r.count))
      .catch(() => {});
  };

  useEffect(() => {
    if (!session) {
      setCount(0);
      setItems([]);
      return;
    }
    fetchCount();
    const id = setInterval(fetchCount, POLL_MS);
    return () => clearInterval(id);
  }, [session]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listNotifications()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!session) return null;

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      await markNotificationRead(n.id).catch(() => {});
      setCount((c) => Math.max(0, c - 1));
      setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, read: true } : p)));
    }
    setOpen(false);
  };

  const markAll = async () => {
    await markAllNotificationsRead().catch(() => {});
    setCount(0);
    setItems((prev) => prev.map((p) => ({ ...p, read: true })));
  };

  return (
    <div ref={ref} className="relative">
      <button
        data-testid="notifications-trigger"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-12 bg-white text-ink transition-colors hover:border-ink"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span
            data-testid="notifications-badge"
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-sun px-1 font-mono text-[10px] font-bold text-ink"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <div
          data-testid="notifications-panel"
          className="absolute right-0 top-12 z-50 w-[360px] overflow-hidden rounded-lg border border-ink-12 bg-white shadow-[0_24px_60px_-20px_rgba(26,26,26,0.25)]"
        >
          <div className="flex items-center justify-between border-b border-ink-10 px-4 py-3">
            <p className="font-display text-[14px] font-semibold text-ink">Notifications</p>
            <div className="flex items-center gap-3 text-[12px]">
              {count > 0 && (
                <button onClick={markAll} className="text-ink-60 hover:text-ink">Mark all read</button>
              )}
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4 text-ink-40" />
              </button>
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-[13px] text-ink-60">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-ink-60">
                You&rsquo;re all caught up.
              </div>
            ) : (
              items.map((n) => {
                const inner = (
                  <div
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-cream-2",
                      !n.read && "bg-sun/5",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.read ? "bg-ink-20" : "bg-sun",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-ink">{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-60">{n.body}</p>}
                      <p className="mt-1 font-mono text-[10.5px] text-ink-40">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
                return n.href ? (
                  <Link
                    key={n.id}
                    to={n.href}
                    onClick={() => handleClick(n)}
                    className="block border-b border-ink-10 last:border-0"
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className="block w-full border-b border-ink-10 last:border-0"
                  >
                    {inner}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
