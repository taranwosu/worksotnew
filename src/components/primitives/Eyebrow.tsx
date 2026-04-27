import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

type EyebrowProps = HTMLAttributes<HTMLDivElement> & {
  index?: string;
  children: ReactNode;
  accent?: boolean;
};

/**
 * Editorial dateline / section label. Mono, uppercase, tracked.
 * Optional `index` prepends a label like "§ 02" for magazine feel.
 */
export function Eyebrow({
  index,
  accent = false,
  className,
  children,
  ...rest
}: EyebrowProps) {
  return (
    <div
      className={cn(
        "eyebrow inline-flex items-center gap-2 text-ink-60",
        className,
      )}
      {...rest}
    >
      {accent && (
        <span
          aria-hidden
          className="inline-block h-[6px] w-[6px] rounded-pill bg-sun"
        />
      )}
      {index && (
        <span className="text-ink font-mono tracking-[0.14em]">{index}</span>
      )}
      {index && <span aria-hidden className="text-ink-20">/</span>}
      <span>{children}</span>
    </div>
  );
}
