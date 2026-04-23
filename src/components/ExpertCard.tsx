import { Link } from "@tanstack/react-router";
import { Star, MapPin, Clock, BadgeCheck, ArrowUpRight } from "lucide-react";
import type { Expert } from "@/data/experts";
import { Tag } from "@/components/primitives";
import { cn } from "@/lib/utils";

type ExpertCardProps = {
  expert: Expert;
  index?: number;
  layout?: "stack" | "row";
  className?: string;
};

export function ExpertCard({
  expert,
  index,
  layout = "stack",
  className,
}: ExpertCardProps) {
  const availableNow = /now/i.test(expert.availability);

  if (layout === "row") {
    return (
      <Link
        to="/experts/$expertId"
        params={{ expertId: expert.id }}
        className={cn(
          "group relative grid grid-cols-12 items-center gap-4 border-b border-ink-12 py-5 transition-colors hover:bg-ink-08/40",
          className,
        )}
      >
        {typeof index === "number" && (
          <div className="col-span-1 font-mono text-[11px] tracking-[0.14em] text-ink-40 tabular">
            {String(index + 1).padStart(2, "0")}
          </div>
        )}
        <div className="col-span-10 flex items-center gap-4 md:col-span-4">
          <div className="relative h-14 w-14 overflow-hidden rounded bg-cream-3">
            <img
              src={expert.image}
              alt=""
              className="h-full w-full object-cover transition-transform duration-[var(--dur-slow)] ease-out group-hover:scale-[1.04]"
            />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-display text-[16px] font-semibold tracking-[-0.005em] text-ink">
              <span className="truncate">{expert.name}</span>
              {expert.verified && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-sun-2" />
              )}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-ink-60">
              {expert.title}
            </p>
          </div>
        </div>
        <div className="col-span-6 hidden md:col-span-3 md:block">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
            Practice
          </p>
          <p className="mt-1 text-[13px] text-ink">{expert.specialty}</p>
        </div>
        <div className="col-span-4 hidden md:col-span-2 md:block">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
            Location
          </p>
          <p className="mt-1 text-[13px] text-ink">{expert.location}</p>
        </div>
        <div className="col-span-12 flex items-center justify-between md:col-span-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
              Rate
            </p>
            <p className="mt-1 font-display text-[17px] font-semibold tabular text-ink">
              ${expert.hourlyRate}
              <span className="ml-0.5 text-[12px] font-normal text-ink-40">
                /hr
              </span>
            </p>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-40 transition-transform duration-[var(--dur-base)] ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/experts/$expertId"
      params={{ expertId: expert.id }}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded border border-ink-12 bg-white transition-all duration-[var(--dur-base)] ease-out hover:-translate-y-[2px] hover:border-ink hover:shadow-[0_18px_40px_-22px_rgba(26,26,26,0.3)]",
        className,
      )}
    >
      <div className="relative aspect-[5/4] overflow-hidden bg-cream-3">
        <img
          src={expert.image}
          alt={expert.name}
          className="h-full w-full object-cover transition-transform duration-[var(--dur-slow)] ease-out group-hover:scale-[1.03]"
        />
        {/* Top-left file-no */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <Tag tone="ink" size="sm" className="font-mono">
            № {expert.id.slice(0, 3).toUpperCase()}
          </Tag>
          {expert.topRated && (
            <Tag tone="sun" size="sm">
              Top rated
            </Tag>
          )}
        </div>
        {/* Availability */}
        <div className="absolute right-3 top-3">
          <Tag
            tone={availableNow ? "ink" : "cream"}
            size="sm"
            dot={availableNow}
            className={availableNow ? "bg-ink text-cream" : ""}
          >
            {expert.availability}
          </Tag>
        </div>
        {/* Bottom meta overlay */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-ink/75 via-ink/20 to-transparent p-3 text-cream">
          <div className="flex items-center gap-1 text-[11px]">
            <Star className="h-3 w-3 fill-sun text-sun" />
            <span className="font-semibold tabular">{expert.rating}</span>
            <span className="text-cream/60">({expert.reviewCount})</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-cream/80">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {expert.location.split(",")[0]}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {expert.responseTime}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60">
          {expert.specialty}
        </p>
        <h3 className="mt-2 flex items-center gap-1.5 font-display text-[19px] font-semibold leading-tight tracking-[-0.01em] text-ink">
          <span className="truncate">{expert.name}</span>
          {expert.verified && (
            <BadgeCheck className="h-4 w-4 shrink-0 text-sun-2" />
          )}
        </h3>
        <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-ink-60">
          {expert.title}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {expert.skills.slice(0, 3).map((skill) => (
            <Tag key={skill} tone="outline" size="sm">
              {skill}
            </Tag>
          ))}
          {expert.skills.length > 3 && (
            <span className="text-[11px] text-ink-40">
              +{expert.skills.length - 3}
            </span>
          )}
        </div>

        <div className="mt-5 flex items-end justify-between border-t border-ink-10 pt-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
              USD/hr
            </p>
            <p className="font-display text-[22px] font-semibold leading-none tabular text-ink">
              {expert.hourlyRate}
            </p>
          </div>
          <span className="link-sweep inline-flex items-center gap-1 text-[13px] font-semibold text-ink">
            Read the file
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        </div>
      </div>
    </Link>
  );
}
