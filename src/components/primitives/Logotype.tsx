import { cn } from "@/lib/utils";

/**
 * Logotype — no generic compass icon. A custom sun-wedge mark in Sun,
 * paired with the wordmark in display type. Single-colour, scales cleanly.
 */
export function Logotype({
  className,
  tone = "ink",
  compact = false,
}: {
  className?: string;
  tone?: "ink" | "cream";
  compact?: boolean;
}) {
  const fg = tone === "ink" ? "text-ink" : "text-cream";
  return (
    <div className={cn("flex items-center gap-2.5", fg, className)}>
      <Mark />
      {!compact && (
        <span
          className={cn(
            "font-display text-[19px] font-semibold leading-none tracking-[-0.03em]",
          )}
        >
          worksoy
          <span className="text-sun">.</span>
        </span>
      )}
    </div>
  );
}

function Mark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      {/* sun disc */}
      <circle cx="16" cy="16" r="6.5" fill="#FFC13B" />
      {/* ink wedge wrap */}
      <path
        d="M16 3.5 A12.5 12.5 0 0 1 28.5 16 L22 16 A6.5 6.5 0 0 0 16 9.5 Z"
        fill="currentColor"
      />
      <path
        d="M3.5 16 A12.5 12.5 0 0 1 16 3.5 L16 9.5 A6.5 6.5 0 0 0 9.5 16 Z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  );
}
