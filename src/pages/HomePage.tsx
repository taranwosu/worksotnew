import { Link } from "@tanstack/react-router";
import { Compass, Shield, Search, Sparkles, ArrowRight, CheckCircle2, Star } from "lucide-react";
import { experts, heroImages } from "@/data/experts";
import { ExpertCard } from "@/components/ExpertCard";

export function HomePage() {
  const featured = experts.slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImages.trueNorth}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/60" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 lg:px-8 lg:pb-32 lg:pt-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-slate-500" />
              Trusted by 1,200+ companies
            </div>

            <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
              Work your way
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-br from-slate-800 to-slate-600 bg-clip-text text-transparent"> at WorkSoy</span>
              </span>
              <br />
              with vetted experts.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              The premium network for senior-level accountants, consultants, designers, engineers, and compliance specialists. Vetted, verified, and ready to work on your terms.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/experts"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-slate-800 hover:shadow-xl hover:scale-[1.02]"
              >
                Browse the network
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white/80 px-6 py-3.5 text-sm font-semibold text-slate-900 backdrop-blur transition-all hover:bg-white hover:shadow-md"
              >
                How it works
              </Link>
            </div>

            <div className="mt-10 flex items-center gap-6 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {experts.slice(0, 4).map((e) => (
                    <img key={e.id} src={e.image} alt="" className="h-8 w-8 rounded-full border-2 border-white object-cover" />
                  ))}
                </div>
                <span className="text-xs font-medium">3,800+ experts</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                4.96 avg rating
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-slate-200 bg-slate-50/50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
          {[
            { label: "Vetted experts", value: "3,800+" },
            { label: "Projects completed", value: "24,500+" },
            { label: "Avg. hire time", value: "48 hrs" },
            { label: "Client satisfaction", value: "98%" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{stat.value}</div>
              <div className="mt-1 text-sm text-slate-600">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Categories</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Expertise across every discipline
            </h2>
          </div>
          <Link to="/experts" className="hidden text-sm font-semibold text-slate-900 hover:text-blue-600 md:inline-flex">
            View all →
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Accounting & Tax", desc: "CPAs, fractional CFOs, tax strategists", count: 420 },
            { title: "Consulting", desc: "Strategy, ops, management consultants", count: 380 },
            { title: "Design & UX", desc: "Product, brand, research specialists", count: 640 },
            { title: "Engineering", desc: "Software, structural, mechanical PEs", count: 510 },
            { title: "Compliance", desc: "SOC 2, HIPAA, GDPR, ISO specialists", count: 240 },
            { title: "Project Management", desc: "PMPs, scrum masters, program leads", count: 390 },
          ].map((cat) => (
            <Link
              key={cat.title}
              to="/experts"
              className="group rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-slate-900 hover:shadow-lg"
            >
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">{cat.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{cat.desc}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{cat.count} experts</span>
                <ArrowRight className="h-4 w-4 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-slate-900" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured experts */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Featured</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Top-rated experts this month
              </h2>
            </div>
            <Link to="/experts" className="hidden text-sm font-semibold text-slate-900 hover:text-blue-600 md:inline-flex">
              View all →
            </Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((e) => (
              <ExpertCard key={e.id} expert={e} />
            ))}
          </div>
        </div>
      </section>

      {/* Why WorkSoy */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute right-0 top-0 h-full w-1/2 opacity-[0.04]">
          <img src={heroImages.horizon} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Why WorkSoy</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                A higher standard for project-based expertise
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                We&apos;re not a freelance marketplace. We&apos;re a curated network of senior professionals — the kind of people you&apos;d hire full-time if you could.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {[
                { icon: Shield, title: "Rigorous vetting", desc: "Every expert passes background, credential, and portfolio review." },
                { icon: Search, title: "Smart matching", desc: "Describe your project — we surface the 3 best-fit experts within 48 hours." },
                { icon: Compass, title: "Clear scoping", desc: "Transparent SOWs, milestone-based contracts, and fixed-fee options." },
                { icon: CheckCircle2, title: "Quality guarantee", desc: "Rework covered for 30 days. Dispute resolution built in." },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-5">
                  <f.icon className="h-6 w-6 text-slate-900" strokeWidth={2} />
                  <h3 className="mt-3 text-base font-semibold tracking-tight text-slate-900">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-8 py-16 sm:px-16">
          <div className="absolute inset-0 opacity-20">
            <img src={heroImages.compassMountain} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="relative max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to navigate your next project with confidence?
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              Post your brief, meet your top 3 matches within 48 hours, and hire without the usual hiring cycle.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/experts" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl">
                Find an expert
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/for-experts" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition-all hover:bg-white/10">
                Join as an expert
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
