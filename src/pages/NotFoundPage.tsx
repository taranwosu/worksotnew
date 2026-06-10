import { Home, Search } from "lucide-react";
import { Container, Eyebrow, LinkButton } from "@/components/primitives";

export function NotFoundPage() {
  return (
    <div className="bg-cream">
      <Container className="flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
        <Eyebrow index="§ 404" accent>Page not found</Eyebrow>
        <h1 className="mt-5 font-display text-[clamp(3rem,9vw,7rem)] font-medium leading-[0.9] tracking-[-0.04em] text-ink">
          404
        </h1>
        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-60">
          The page you were looking for has moved, been retired, or never
          existed. Let&rsquo;s get you back on track.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <LinkButton to="/" tone="ink" size="md" iconLeft={<Home className="h-4 w-4" />}>
            Back to home
          </LinkButton>
          <LinkButton to="/experts" tone="outline" size="md" iconLeft={<Search className="h-4 w-4" />}>
            Browse the network
          </LinkButton>
        </div>
      </Container>
    </div>
  );
}
