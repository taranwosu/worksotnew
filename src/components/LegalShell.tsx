import type { ReactNode } from "react";
import { Container, Eyebrow, Tag } from "@/components/primitives";

type LegalShellProps = {
  index: string;
  kicker: string;
  title: string;
  lastUpdated: string;
  intro?: ReactNode;
  children: ReactNode;
};

/**
 * Shared visual wrapper for Terms, Privacy, AUP and similar long-form
 * legal copy. Editorial layout with a "DRAFT" stamp until counsel
 * signs off.
 */
export function LegalShell({ index, kicker, title, lastUpdated, intro, children }: LegalShellProps) {
  return (
    <div className="bg-cream pb-24 pt-16 md:pt-20">
      <Container>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <Eyebrow index={index} accent>
              {kicker}
            </Eyebrow>
            <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.02em] text-ink">
              {title}
            </h1>
            <p className="mt-3 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink-60">
              Last updated · {lastUpdated}
            </p>
          </div>
          <Tag tone="sun" size="md" data-testid="legal-draft-stamp">
            Draft — review before go-live
          </Tag>
        </div>

        {intro && (
          <p className="mt-8 max-w-3xl text-[15px] leading-relaxed text-ink-60">{intro}</p>
        )}

        <article className="mt-12 max-w-3xl space-y-10 text-[15px] leading-relaxed text-ink">
          {children}
        </article>
      </Container>
    </div>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="border-b border-ink-12 pb-2 font-display text-[22px] font-medium tracking-[-0.01em] text-ink">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[14.5px] leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}
