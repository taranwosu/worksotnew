import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RevealProps = HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section" | "article" | "li" | "p" | "h2" | "h3" | "span";
  delay?: number;
  once?: boolean;
  children: ReactNode;
};

/**
 * Scroll-linked reveal. Adds `.in` once the element crosses the viewport.
 * Pair with `.reveal` base class in index.css. Uses IntersectionObserver —
 * no external deps; cheap enough to sprinkle liberally.
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  once = true,
  className,
  children,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            setShown(false);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  const Component = Tag as "div";
  return (
    <Component
      ref={ref as React.RefObject<HTMLDivElement>}
      className={cn("reveal", shown && "in", className)}
      style={{ transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Component>
  );
}
