import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { addShortlist, listShortlists, removeShortlist } from "@/lib/api";
import { cn } from "@/lib/utils";

const STORE_KEY = "worksoy:shortlist-ids";

function readCache(): string[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
function writeCache(ids: string[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function ShortlistButton({
  expertId,
  size = "md",
  className,
}: {
  expertId: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const { data: session } = useSession();
  const [ids, setIds] = useState<string[]>(() => readCache());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    listShortlists()
      .then((list) => {
        const next = list.map((s) => s.expert_id);
        setIds(next);
        writeCache(next);
      })
      .catch(() => {});
  }, [session]);

  const active = ids.includes(expertId);
  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session) {
      window.location.href = "/signin";
      return;
    }
    setBusy(true);
    try {
      if (active) {
        await removeShortlist(expertId);
        const next = ids.filter((i) => i !== expertId);
        setIds(next);
        writeCache(next);
      } else {
        await addShortlist(expertId);
        const next = [...ids, expertId];
        setIds(next);
        writeCache(next);
      }
    } catch (err) {
      // Silent — surface in console; UI keeps prior state
      console.error("shortlist toggle failed", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={active ? "Remove from shortlist" : "Add to shortlist"}
      data-testid={`shortlist-${expertId}`}
      data-active={active}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border bg-white transition-colors",
        active ? "border-rust bg-rust/10 text-rust" : "border-ink-12 text-ink-60 hover:border-ink hover:text-ink",
        dim,
        className,
      )}
    >
      <Heart
        className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", active && "fill-rust text-rust")}
        strokeWidth={1.75}
      />
    </button>
  );
}
