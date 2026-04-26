import { ReactNode } from "react";
import { Container, Eyebrow } from "@/components/primitives";

export type LegalSection = {
  heading: string;
  body: ReactNode;
};

type Props = {
  index: string;
  eyebrow: string;
  title: string;
  effectiveDate: string;
  intro?: ReactNode;
  sections: LegalSection[];
};

export function LegalPage({ index, eyebrow, title, effectiveDate, intro, sections }: Props) {
  return (
    <div className="bg-cream">
      <section className="border-b border-ink-12 pt-16 md:pt-20">
        <Container>
          <div className="flex items-center justify-between border-b border-ink-12 pb-6">
            <Eyebrow index={index} accent>
              {eyebrow}
            </Eyebrow>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
              Effective {effectiveDate}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-10 pt-10 md:grid-cols-12 md:pt-14">
            <div className="md:col-span-8">
              <h1 className="display-xl text-ink">{title}</h1>
            </div>
            {intro ? (
              <div className="md:col-span-4 md:pt-4">
                <p className="prose-lede">{intro}</p>
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      <section className="py-16 md:py-24">
        <Container>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-12">
            <aside className="md:col-span-4">
              <Eyebrow index="§ 02" accent>
                Contents
              </Eyebrow>
              <ol className="mt-6 divide-y divide-ink-12 border-y border-ink-12 font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-60">
                {sections.map((s, i) => (
                  <li key={s.heading} className="flex gap-3 py-3">
                    <span className="tabular text-ink-40">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <a
                      href={`#${slug(s.heading)}`}
                      className="hover:text-ink"
                    >
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
              <p className="mt-8 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-40">
                Draft · pending counsel review
              </p>
            </aside>

            <article className="md:col-span-8">
              <div className="space-y-12">
                {sections.map((s, i) => (
                  <section key={s.heading} id={slug(s.heading)} className="scroll-mt-24">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-40">
                      § {String(i + 1).padStart(2, "0")}
                    </p>
                    <h2 className="mt-2 font-display text-[clamp(1.5rem,2.4vw,1.875rem)] font-medium leading-[1.15] tracking-[-0.02em] text-ink">
                      {s.heading}
                    </h2>
                    <div className="prose-legal mt-4 space-y-4 text-[14.5px] leading-relaxed text-ink-80">
                      {s.body}
                    </div>
                  </section>
                ))}
              </div>
            </article>
          </div>
        </Container>
      </section>
    </div>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
