import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section" | "article" | "header" | "footer" | "main";
  bleed?: boolean;
};

/**
 * 12-col container, 8-px rhythm. Use for every page section so horizontal
 * rhythm stays consistent. `bleed` drops horizontal padding for edge-to-edge
 * bands (e.g. dark slabs with internal grid).
 */
export function Container({
  as: Tag = "div",
  bleed = false,
  className,
  ...rest
}: ContainerProps) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full max-w-[1280px]",
        !bleed && "px-6 md:px-10 lg:px-12",
        className,
      )}
      {...rest}
    />
  );
}

export function Grid12({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid grid-cols-4 gap-x-4 gap-y-6 md:grid-cols-12 md:gap-x-6",
        className,
      )}
      {...rest}
    />
  );
}
