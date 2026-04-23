import { Link } from "@tanstack/react-router";
import { FileText, Users, Handshake, CheckCircle2, ArrowRight } from "lucide-react";
import { heroImages } from "@/data/experts";

export function HowItWorksPage() {
  const steps = [
    { icon: FileText, title: "Post your project", desc: "Describe your scope, timeline, and budget in our guided brief. Takes about 5 minutes." },
    { icon: Users, title: "Meet your matches", desc: "Within 48 hours, we surface the 3 best-fit experts from our vetted network." },
    { icon: Handshake, title: "Interview & hire", desc: "Chat on platform, review portfolios, and hire on hourly or fixed-fee terms." },
    { icon: CheckCircle2, title: "Ship great work", desc: "Milestone-based payments, 30-day quality guarantee, and seamless invoicing." },
  ];

  return (
    <div>
      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50">
        <div className="absolute inset-0 opacity-30">
          <img src={heroImages.horizon} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-slate-50" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">How It Works</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">From brief to hire in 48 hours</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            We&apos;ve engineered a hiring flow that respects both sides&apos; time. No endless scrolling, no bidding wars.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div key={step.title} className="relative rounded-2xl border border-slate-200 bg-white p-6">
              <div className="absolute -top-3 left-6 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Step {i + 1}</div>
              <step.icon className="h-8 w-8 text-slate-900" strokeWidth={1.75} />
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Ready to start?</h2>
          <p className="mt-2 text-slate-600">Post your project free. Only pay when you hire.</p>
          <Link to="/experts" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800">
            Find an expert <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
