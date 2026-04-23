import { Link } from "@tanstack/react-router";
import { Star, MapPin, Clock, BadgeCheck, Award } from "lucide-react";
import type { Expert } from "@/data/experts";

export function ExpertCard({ expert }: { expert: Expert }) {
  return (
    <Link
      to="/experts/$expertId"
      params={{ expertId: expert.id }}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-xl"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <img
          src={expert.image}
          alt={expert.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {expert.topRated && (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-900 shadow-sm backdrop-blur">
            <Award className="h-3 w-3 text-amber-500" />
            Top Rated
          </div>
        )}
        <div className="absolute right-3 top-3 rounded-full bg-emerald-500/95 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
          {expert.availability}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-slate-900">
              <span className="truncate">{expert.name}</span>
              {expert.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-blue-600" />}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-sm text-slate-600">{expert.title}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {expert.skills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
            >
              {skill}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-slate-900">{expert.rating}</span>
            <span>({expert.reviewCount})</span>
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {expert.location}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {expert.responseTime}
          </span>
        </div>

        <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-4">
          <div>
            <span className="text-xl font-bold tracking-tight text-slate-900">${expert.hourlyRate}</span>
            <span className="text-sm text-slate-500">/hr</span>
          </div>
          <span className="text-sm font-semibold text-slate-900 transition-colors group-hover:text-blue-600">
            View profile →
          </span>
        </div>
      </div>
    </Link>
  );
}
