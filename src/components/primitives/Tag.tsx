import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type TagProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "ink" | "cream" | "sun" | "moss" | "rust" | "outline";
  size?: "sm" | "md";
  dot?: boolean;
};

const toneMap = {
  default: "bg-ink-08 text-ink",
  ink: "bg-ink text-cream",
  cream: "bg-cream-2 text-ink",
  sun: "bg-sun text-ink",
  moss: "bg-moss text-cream",
  rust: "bg-rust text-cream",
  outline: "border border-ink-20 text-ink bg-transparent",
};

const sizeMap = {
  sm: "h-[22px] px-2 text-[11px]",
  md: "h-7 px-2.5 text-xs",
};

export function Tag({
  tone = "default",
  size = "md",
  dot = false,
  className,
  children,
  ...rest
}: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm font-medium tracking-[-0.005em] leading-none",
        toneMap[tone],
        sizeMap[size],
        className,
      )}
      {...rest}
    >
      {dot && (
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-current opacity-50 live-dot" />
          <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
