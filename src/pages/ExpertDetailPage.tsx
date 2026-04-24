import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  Star,
  MapPin,
  Clock,
  BadgeCheck,
  ArrowLeft,
  Globe,
  Briefcase,
  MessageSquare,
  Award,
  ShieldCheck,
  Quote,
} from "lucide-react";
import type { Expert } from "@/data/experts";
import { fetchExpert, getExpertReviews, type Review } from "@/lib/api";
import {
  Container,
  Eyebrow,
  LinkButton,
  Button,
  Tag,
} from "@/components/primitives";

export function ExpertDetailPage() {
  const { expertId } = useParams({ strict: false }) as { expertId: string };
  const [expert, setExpert] = useState<Expert | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchExpert(expertId),
      getExpertReviews(expertId).catch(() => [] as Review[]),
    ])
      .then(([e, r]) => {
        setExpert(e);
        setReviews(r);
      })
      .catch(() => setExpert(null))
      .finally(() => setLoading(false));
  }, [expertId]);

  if (loading) {
    return (
      <Container className="py-24 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
          Loading file…
        </p>
      </Container>
    );
  }

  if (!expert) {
    return (
      <Container className="py-24 text-center">
        <Eyebrow index="§ 404" accent>
          Off-roster
        </Eyebrow>
        <h1 className="mt-4 font-display text-[clamp(2.25rem,4vw,3rem)] font-medium text-ink">
          That file is not in the directory.
        </h1>
        <p className="mt-4 text-ink-60">
          They may have left the network or the link is stale.
        </p>
        <LinkButton
          to="/experts"
          tone="ink"
          size="md"
          className="mt-8"
          arrow
        >
          Back to the directory
        </LinkButton>
      </Container>
    );
  }

  const availableNow = /now/i.test(expert.availability);

  return (
    <div className="bg-cream">
      {/* Breadcrumb + file-no band */}
      <div className="border-b border-ink-12 bg-paper">
        <Container className="flex h-12 items-center justify-between text-[12px]">
          <Link
            to="/experts"
            className="inline-flex items-center gap-1.5 font-medium text-ink-60 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Directory
          </Link>
          <p className="font-mono uppercase tracking-[0.14em] text-ink-60">
            File № {expert.id.toUpperCase()} · {expert.category}
          </p>
        </Container>
      </div>

      {/* Header */}
      <section className="border-b border-ink-12">
        <Container className="py-14 md:py-20">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-8">
            <div className="md:col-span-8">
              <Eyebrow accent>{expert.specialty}</Eyebrow>
              <h1 className="mt-5 flex flex-wrap items-center gap-3 font-display text-[clamp(2.5rem,5.5vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.03em] text-ink">
                <span>{expert.name}</span>
                {expert.verified && (
                  <BadgeCheck className="h-7 w-7 shrink-0 text-sun-2" />
                )}
              </h1>
              <p className="mt-3 font-display text-[clamp(1.125rem,2vw,1.5rem)] text-ink-60">
                {expert.title}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-ink-60">
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-sun text-sun" />
                  <span className="font-semibold text-ink tabular">
                    {expert.rating}
                  </span>
                  <span>({expert.reviewCount} reviews)</span>
                </span>
                <span className="h-3 w-px bg-ink-12" />
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {expert.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Responds {expert.responseTime}
                </span>
                <span className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" />
                  {expert.experience}
                </span>
                {expert.topRated && (
                  <Tag tone="sun" size="sm">
                    <Award className="h-3 w-3" />
                    Top rated
                  </Tag>
                )}
              </div>
            </div>

            {/* Portrait */}
            <div className="md:col-span-4">
              <div className="relative aspect-[4/5] overflow-hidden rounded border border-ink-12 bg-cream-3">
                <img
                  src={expert.image}
                  alt={expert.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute left-3 top-3">
                  <Tag
                    tone={availableNow ? "ink" : "cream"}
                    size="sm"
                    dot={availableNow}
                  >
                    {expert.availability}
                  </Tag>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Body */}
      <section className="py-14 md:py-20">
        <Container>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-12">
            {/* Main column */}
            <div className="md:col-span-8">
              <Section index="§ 01" kicker="The practice">
                <p className="font-display text-[clamp(1.125rem,1.8vw,1.375rem)] leading-[1.4] tracking-[-0.01em] text-ink">
                  {expert.bio}
                </p>
              </Section>

              <Section index="§ 02" kicker="Capabilities">
                <div className="flex flex-wrap gap-2">
                  {expert.skills.map((skill) => (
                    <Tag key={skill} tone="outline" size="md">
                      {skill}
                    </Tag>
                  ))}
                </div>
              </Section>

              <Section index="§ 03" kicker="Details">
                <dl className="grid grid-cols-2 gap-px bg-ink-12 md:grid-cols-4">
                  <DetailTile
                    icon={Globe}
                    label="Languages"
                    value={expert.languages.join(", ")}
                  />
                  <DetailTile
                    icon={Briefcase}
                    label="Engagements"
                    value={`${expert.completedProjects}+`}
                  />
                  <DetailTile
                    icon={Clock}
                    label="Response"
                    value={expert.responseTime}
                  />
                  <DetailTile
                    icon={Award}
                    label="Experience"
                    value={expert.experience}
                  />
                </dl>
              </Section>

              <Section index="§ 04" kicker="Client notes">
                {reviews.length === 0 ? (
                  <div className="rounded border border-dashed border-ink-20 bg-white px-6 py-10 text-center text-[13px] text-ink-60" data-testid="no-reviews-empty">
                    No published reviews yet. Reviews appear here after a completed engagement.
                  </div>
                ) : (
                  <ul className="divide-y divide-ink-12 border-y border-ink-12" data-testid="expert-reviews">
                    {reviews.map((r) => (
                      <li
                        key={r.id}
                        className="grid grid-cols-12 items-start gap-4 py-8"
                      >
                        <div className="col-span-12 md:col-span-2">
                          <Quote
                            className="h-5 w-5 text-sun"
                            strokeWidth={1.5}
                          />
                          <div className="mt-2 flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, j) => (
                              <Star
                                key={j}
                                className={`h-3.5 w-3.5 ${
                                  j < r.rating ? "fill-sun text-sun" : "text-ink-20"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="col-span-12 md:col-span-10">
                          <p className="font-display text-[clamp(1.125rem,1.7vw,1.375rem)] leading-[1.4] tracking-[-0.01em] text-ink">
                            &ldquo;{r.comment}&rdquo;
                          </p>
                          <p className="mt-4 text-[13px] text-ink-60">
                            <span className="font-semibold text-ink">
                              {r.reviewer_name}
                            </span>
                            <span className="mx-2 text-ink-20">/</span>
                            {new Date(r.created_at).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                            })}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            {/* Aside — booking card */}
            <aside className="md:col-span-4">
              <div className="sticky top-24">
                <div className="rounded border border-ink-12 bg-white">
                  <div className="border-b border-ink-12 bg-cream-2 px-5 py-3">
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink">
                      Engagement card
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-[44px] font-medium leading-none tracking-[-0.03em] tabular text-ink">
                        ${expert.hourlyRate}
                      </span>
                      <span className="text-[14px] text-ink-60">/hr</span>
                    </div>
                    <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                      Rate band · P50 for {expert.specialty.toLowerCase()}
                    </p>

                    <div className="mt-4">
                      <Tag
                        tone={availableNow ? "ink" : "cream"}
                        size="sm"
                        dot={availableNow}
                      >
                        {expert.availability}
                      </Tag>
                    </div>

                    <div className="mt-6 space-y-2">
                      <Button
                        tone="ink"
                        size="lg"
                        arrow
                        className="w-full"
                        iconLeft={
                          <MessageSquare className="h-4 w-4" strokeWidth={2} />
                        }
                      >
                        Message {expert.name.split(" ")[0]}
                      </Button>
                      <LinkButton
                        to="/post-request"
                        tone="cream"
                        size="lg"
                        className="w-full"
                      >
                        Request a proposal
                      </LinkButton>
                    </div>

                    <div className="mt-6 space-y-3 border-t border-ink-12 pt-5 text-[13px]">
                      {[
                        "Identity & credentials verified",
                        "30-day rework window",
                        "Escrow-backed milestones",
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-2">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sun-2" />
                          <span className="text-ink-60">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
                  Counter-signed SOW · funded escrow
                </p>
              </div>
            </aside>
          </div>
        </Container>
      </section>
    </div>
  );
}

function Section({
  index,
  kicker,
  children,
}: {
  index: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <header className="mb-6 flex items-center gap-2 border-b border-ink-12 pb-3">
        <span className="font-mono text-[11px] tracking-[0.14em] text-ink-60">
          {index}
        </span>
        <span className="font-mono text-[11px] tracking-[0.14em] text-ink-20">
          /
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
          {kicker}
        </span>
      </header>
      {children}
    </section>
  );
}

function DetailTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-cream p-5">
      <Icon className="h-4 w-4 text-ink-40" strokeWidth={1.75} />
      <dt className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
        {label}
      </dt>
      <dd className="mt-1.5 font-display text-[15px] font-semibold text-ink">
        {value}
      </dd>
    </div>
  );
}
