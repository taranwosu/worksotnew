import { Link, useParams } from "@tanstack/react-router";
import { Star, MapPin, Clock, BadgeCheck, Award, ArrowLeft, Globe, Briefcase, MessageSquare } from "lucide-react";
import { experts } from "@/data/experts";

export function ExpertDetailPage() {
  const { expertId } = useParams({ strict: false }) as { expertId: string };
  const expert = experts.find((e) => e.id === expertId);

  if (!expert) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Expert not found</h1>
        <Link to="/experts" className="mt-4 inline-block text-sm font-semibold text-blue-600">← Back to experts</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/experts" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to experts
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="relative aspect-[16/9] bg-slate-100">
              <img src={expert.image} alt={expert.name} className="h-full w-full object-cover" />
              {expert.topRated && (
                <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-900 shadow backdrop-blur">
                  <Award className="h-3.5 w-3.5 text-amber-500" />
                  Top Rated
                </div>
              )}
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {expert.name}
                    {expert.verified && <BadgeCheck className="h-6 w-6 text-blue-600" />}
                  </h1>
                  <p className="mt-1 text-lg text-slate-600">{expert.title}</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-sm">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-slate-900">{expert.rating}</span>
                  <span className="text-slate-600">({expert.reviewCount} reviews)</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{expert.location}</span>
                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />Responds in {expert.responseTime}</span>
                <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" />{expert.experience} experience</span>
              </div>
            </div>
          </div>

          <Section title="About">
            <p className="text-base leading-relaxed text-slate-700">{expert.bio}</p>
          </Section>

          <Section title="Skills & Expertise">
            <div className="flex flex-wrap gap-2">
              {expert.skills.map((skill) => (
                <span key={skill} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">{skill}</span>
              ))}
            </div>
          </Section>

          <Section title="Details">
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailRow icon={Globe} label="Languages" value={expert.languages.join(", ")} />
              <DetailRow icon={Briefcase} label="Projects completed" value={`${expert.completedProjects}+`} />
              <DetailRow icon={Clock} label="Response time" value={expert.responseTime} />
              <DetailRow icon={Award} label="Experience" value={expert.experience} />
            </dl>
          </Section>
        </div>

        {/* Sidebar */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-slate-900">${expert.hourlyRate}</span>
              <span className="text-slate-600">/hr</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {expert.availability}
            </div>

            <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md">
              <MessageSquare className="h-4 w-4" />
              Contact {expert.name.split(" ")[0]}
            </button>
            <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-50">
              Request a proposal
            </button>

            <div className="mt-6 space-y-3 border-t border-slate-100 pt-6 text-sm">
              <div className="flex items-start gap-2 text-slate-600">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>Identity and credentials verified</span>
              </div>
              <div className="flex items-start gap-2 text-slate-600">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>30-day quality guarantee on all work</span>
              </div>
              <div className="flex items-start gap-2 text-slate-600">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>Secure milestone-based payments</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 text-slate-400" />
      <div>
        <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-slate-900">{value}</dd>
      </div>
    </div>
  );
}
