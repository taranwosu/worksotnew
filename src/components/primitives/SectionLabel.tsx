import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

/**
 * Top-of-section header pattern: eyebrow + editorial heading + lede.
 * Use consistently so every band has rhythm and the same sidebar index.
 */
type Props = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  index: string;
  kicker: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  align?: "left" | "split";
  rightSlot?: React.ReactNode;
};

export function SectionHeader({
  index,
  kicker,
  title,
  lede,
  align = "left",
  rightSlot,
  className,
  ...rest
}: Props) {
  if (align === "split") {
    return (
      <div
        className={cn(
          "grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-6",
          className,
        )}
        {...rest}
      >
        <div className="md:col-span-7">
          <div className="eyebrow flex items-center gap-2 text-ink-60">
            <span className="text-ink">{index}</span>
            <span className="text-ink-20">/</span>
            <span>{kicker}</span>
          </div>
          <h2 className="display-lg mt-4 text-ink">{title}</h2>
        </div>
        <div className="md:col-span-4 md:col-start-9 md:pt-12">
          {lede && <p className="prose-lede">{lede}</p>}
          {rightSlot}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("max-w-3xl", className)} {...rest}>
      <div className="eyebrow flex items-center gap-2 text-ink-60">
        <span className="text-ink">{index}</span>
        <span className="text-ink-20">/</span>
        <span>{kicker}</span>
      </div>
      <h2 className="display-lg mt-4 text-ink">{title}</h2>
      {lede && <p className="prose-lede mt-4">{lede}</p>}
    </div>
  );
}
