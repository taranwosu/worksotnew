import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

type MarqueeProps = HTMLAttributes<HTMLDivElement> & {
  speed?: "slow" | "base" | "fast";
  pauseOnHover?: boolean;
  children: ReactNode;
};

/**
 * Infinite horizontal ticker. Duplicates children once so -50% translate
 * produces a seamless loop. Motion disabled via prefers-reduced-motion
 * in index.css.
 */
export function Marquee({
  speed = "base",
  pauseOnHover = true,
  className,
  children,
  ...rest
}: MarqueeProps) {
  return (
    <div
      className={cn("relative flex overflow-hidden", className)}
      {...rest}
    >
      <div
        className={cn(
          "marquee-track flex min-w-full shrink-0 items-center gap-12 pr-12",
          speed === "slow" && "marquee-slow",
          speed === "fast" && "marquee-fast",
          pauseOnHover && "hover:[animation-play-state:paused]",
        )}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "marquee-track flex min-w-full shrink-0 items-center gap-12 pr-12",
          speed === "slow" && "marquee-slow",
          speed === "fast" && "marquee-fast",
          pauseOnHover && "hover:[animation-play-state:paused]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
