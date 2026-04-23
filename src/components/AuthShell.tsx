import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logotype, Tag } from "@/components/primitives";

type AuthShellProps = {
  step: string;
  kicker: string;
  display: ReactNode;
  lede: ReactNode;
  quote?: { text: string; author: string; role: string };
  children: ReactNode;
};

/**
 * Full-bleed split layout for auth & onboarding. Dark editorial panel
 * on the left carries the brand narrative; the right panel is the form
 * on cream. Scrolls vertically on mobile.
 */
export function AuthShell({
  step,
  kicker,
  display,
  lede,
  quote,
  children,
}: AuthShellProps) {
  return (
    <div className="grid min-h-[calc(100vh-40px)] grid-cols-1 bg-cream md:grid-cols-12">
      {/* Left — editorial */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-cream md:col-span-5 md:flex lg:col-span-5 lg:p-12">
        <div className="grain pointer-events-none absolute inset-0" />
        <svg
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-40 h-[620px] w-[620px] text-sun/30"
          viewBox="0 0 620 620"
        >
          <defs>
            <radialGradient id="authSun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="310" cy="310" r="260" fill="url(#authSun)" />
        </svg>

        <div className="relative">
          <Link to="/" className="inline-block">
            <Logotype tone="cream" />
          </Link>

          <div className="eyebrow mt-14 flex items-center gap-2 text-cream/60">
            <span className="text-cream">{step}</span>
            <span className="text-cream/30">/</span>
            <span>{kicker}</span>
          </div>
          <h1 className="mt-6 font-display text-[clamp(2.25rem,4.2vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.03em] text-cream">
            {display}
          </h1>
          <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-cream/70">
            {lede}
          </p>
        </div>

        {quote && (
          <figure className="relative mt-10 border-t border-cream/15 pt-6">
            <p className="font-display text-[15.5px] italic leading-relaxed text-cream/90">
              &ldquo;{quote.text}&rdquo;
            </p>
            <figcaption className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-cream">{quote.author}</p>
                <p className="text-[11.5px] text-cream/60">{quote.role}</p>
              </div>
              <Tag tone="sun" size="sm">Client</Tag>
            </figcaption>
          </figure>
        )}
      </aside>

      {/* Right — form */}
      <main className="flex items-start justify-center px-6 py-12 md:col-span-7 md:py-16 lg:col-span-7 lg:py-20">
        <div className="w-full max-w-md">
          <div className="md:hidden">
            <Link to="/" className="inline-block">
              <Logotype />
            </Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
