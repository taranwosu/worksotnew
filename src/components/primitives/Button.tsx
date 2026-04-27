import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

type Tone = "ink" | "cream" | "sun" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 font-medium tracking-[-0.005em] transition-all duration-[var(--dur-base)] ease-[cubic-bezier(0.22,0.61,0.36,1)] focus-ring disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded",
  md: "h-11 px-5 text-sm rounded",
  lg: "h-14 px-6 text-[15px] rounded",
};

const tones: Record<Tone, string> = {
  ink:
    "bg-ink text-cream hover:bg-ink-2 active:translate-y-[1px] " +
    "shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]",
  cream:
    "bg-cream text-ink border border-ink-12 hover:border-ink hover:-translate-y-[1px] hover:shadow-[0_8px_0_-4px_rgba(26,26,26,0.06)]",
  sun:
    "bg-sun text-ink hover:bg-[#FFB51F] active:translate-y-[1px] " +
    "shadow-[inset_0_-2px_0_rgba(26,26,26,0.15)]",
  ghost:
    "bg-transparent text-ink hover:bg-ink-08",
  outline:
    "bg-transparent text-ink border border-ink hover:bg-ink hover:text-cream",
};

type Common = {
  tone?: Tone;
  size?: Size;
  arrow?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

type LinkishProps = Common &
  Omit<ComponentProps<typeof Link>, "children"> & {
    children: ReactNode;
  };

type NativeProps = Common &
  ComponentProps<"button"> & { asLink?: false };

export function Button({
  tone = "ink",
  size = "md",
  arrow,
  iconLeft,
  iconRight,
  className,
  children,
  ...rest
}: NativeProps) {
  return (
    <button
      className={cn(base, sizes[size], tones[tone], className)}
      {...rest}
    >
      {iconLeft}
      <span>{children}</span>
      {arrow && <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={2} />}
      {iconRight}
    </button>
  );
}

export function LinkButton({
  tone = "ink",
  size = "md",
  arrow,
  iconLeft,
  iconRight,
  className,
  children,
  ...rest
}: LinkishProps) {
  return (
    <Link
      className={cn(base, sizes[size], tones[tone], className)}
      {...(rest as ComponentProps<typeof Link>)}
    >
      {iconLeft}
      <span>{children}</span>
      {arrow && <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={2} />}
      {iconRight}
    </Link>
  );
}
