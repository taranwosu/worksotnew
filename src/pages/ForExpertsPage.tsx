import { Link } from "@tanstack/react-router";
import { DollarSign, Zap, Shield, ArrowRight } from "lucide-react";
import { heroImages } from "@/data/experts";

export function ForExpertsPage() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImages.compassMountain} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/70 to-slate-900/50" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">For Experts</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">Own your practice. Skip the sales cycle.</h1>
            <p className="mt-6 text-lg text-slate-200">Join 3,800+ senior professionals who&apos;ve replaced the RFP grind with a steady flow of vetted client briefs.</p>
            <Link to="/contact" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 transition-all hover:scale-[1.02] hover:shadow-xl">
              Apply to join <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: DollarSign, title: "Keep more of what you earn", desc: "Industry-low 8% platform fee. Set your own rates. Get paid on time, every time." },
            { icon: Zap, title: "Get matched, not spammed", desc: "We curate briefs to your specialty. No bidding, no lowballing, no race to the bottom." },
            { icon: Shield, title: "Built-in protection", desc: "Vetted clients, clear SOWs, milestone escrow, and dispute resolution on every engagement." },
          ].map((b) => (
            <div key={b.title} className="rounded-2xl border border-slate-200 bg-white p-8">
              <b.icon className="h-8 w-8 text-slate-900" strokeWidth={1.75} />
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-3xl bg-slate-900 p-10 text-center text-white">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Our bar is high. Yours should be too.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-300">We accept fewer than 8% of applicants. Typical experts have 8+ years of experience, verifiable credentials, and a portfolio of senior work.</p>
          <Link to="/contact" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-100">
            Start application <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
