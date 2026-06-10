import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Container, Eyebrow, LinkButton } from "@/components/primitives";

export function NotFoundPage() {
  return (
    <div className="bg-cream pb-24 pt-16 md:pt-24">
      <Container className="text-center">
        <Eyebrow index="§ 404" accent>Not found</Eyebrow>
        <h1 className="mx-auto mt-4 max-w-2xl font-display text-[clamp(2.75rem,8vw,5rem)] font-medium leading-[0.95] tracking-[-0.025em] text-ink">
          That page never <em className="not-italic underline decoration-sun decoration-[6px] underline-offset-[10px]">made the cut.</em>
        </h1>
        <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-ink-60">
          Either the URL is wrong, the page has moved, or the project was archived. Either way, here are some better doors.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <LinkButton to="/" tone="ink" size="lg" iconLeft={<ArrowLeft className="h-4 w-4" />}>
            Return home
          </LinkButton>
          <LinkButton to="/experts" tone="outline" size="lg">
            Browse experts
          </LinkButton>
          <LinkButton to="/briefs" tone="outline" size="lg">
            Open briefs
          </LinkButton>
        </div>
        <div className="mt-14 inline-flex items-center gap-2 rounded-pill border border-ink-12 bg-white px-4 py-2 text-[12.5px] text-ink-60">
          Lost? Email <Link to="/contact" className="ml-1 font-semibold text-ink underline">help@worksoy.com</Link>
        </div>
      </Container>
    </div>
  );
}
