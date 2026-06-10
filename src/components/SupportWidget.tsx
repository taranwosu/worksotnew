import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LifeBuoy, X, Mail, MessageSquareText, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) {
      document.addEventListener("mousedown", onClick);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-5 right-5 z-50 print:hidden">
      {open && (
        <div
          className="mb-3 w-72 overflow-hidden rounded-lg border border-ink-12 bg-white shadow-[0_24px_48px_-20px_rgba(26,26,26,0.35)]"
          data-testid="support-panel"
        >
          <div className="border-b border-ink-10 bg-cream-2 px-4 py-3">
            <p className="font-display text-[15px] font-semibold text-ink">Need a hand?</p>
            <p className="mt-0.5 text-[12px] text-ink-60">We usually reply within one business day.</p>
          </div>
          <div className="p-2">
            <Link
              to="/contact"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded px-3 py-2.5 text-[13.5px] text-ink hover:bg-cream-2"
            >
              <MessageSquareText className="h-4 w-4 text-ink-60" />
              Contact our team
            </Link>
            <a
              href="mailto:support@worksoy.com"
              className="flex items-center gap-3 rounded px-3 py-2.5 text-[13.5px] text-ink hover:bg-cream-2"
            >
              <Mail className="h-4 w-4 text-ink-60" />
              support@worksoy.com
            </a>
            <Link
              to="/how-it-works"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded px-3 py-2.5 text-[13.5px] text-ink hover:bg-cream-2"
            >
              <BookOpen className="h-4 w-4 text-ink-60" />
              How WorkSoy works
            </Link>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="support-widget"
        aria-label={open ? "Close support" : "Open support"}
        aria-expanded={open}
        className={cn(
          "flex h-12 items-center gap-2 rounded-pill border border-ink bg-ink px-4 text-[13px] font-semibold text-cream shadow-[0_12px_30px_-12px_rgba(26,26,26,0.55)] transition-transform hover:-translate-y-0.5",
        )}
      >
        {open ? <X className="h-4 w-4" /> : <LifeBuoy className="h-4 w-4" />}
        <span className="hidden sm:inline">{open ? "Close" : "Support"}</span>
      </button>
    </div>
  );
}
