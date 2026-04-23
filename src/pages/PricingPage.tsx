import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

export function PricingPage() {
  const plans = [
    {
      name: "Starter",
      price: "Free",
      tagline: "For occasional hiring",
      features: ["Post unlimited projects", "Browse full network", "10% platform fee on hires", "Standard support"],
      cta: "Get started",
      highlighted: false,
    },
    {
      name: "Business",
      price: "$249",
      period: "/mo",
      tagline: "For growing teams",
      features: ["Everything in Starter", "Priority matching in 24hrs", "5% platform fee on hires", "Dedicated success manager", "Custom SOW templates"],
      cta: "Start free trial",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      tagline: "For scaled operations",
      features: ["Everything in Business", "Volume pricing", "SSO & SCIM", "Dedicated legal review", "Custom integrations", "SLA-backed support"],
      cta: "Talk to sales",
      highlighted: false,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Pricing</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Simple, transparent pricing</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">Only pay when you hire. No hidden fees, no bidding wars.</p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex flex-col rounded-2xl border p-8 ${
              plan.highlighted
                ? "border-slate-900 bg-slate-900 text-white shadow-xl"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            {plan.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900">MOST POPULAR</div>
            )}
            <h3 className={`text-lg font-semibold ${plan.highlighted ? "text-white" : "text-slate-900"}`}>{plan.name}</h3>
            <p className={`mt-1 text-sm ${plan.highlighted ? "text-slate-300" : "text-slate-600"}`}>{plan.tagline}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
              {plan.period && <span className={plan.highlighted ? "text-slate-400" : "text-slate-600"}>{plan.period}</span>}
            </div>

            <ul className="mt-8 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlighted ? "text-emerald-400" : "text-emerald-600"}`} />
                  <span className={plan.highlighted ? "text-slate-200" : "text-slate-700"}>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              to={plan.name === "Enterprise" ? "/contact" : "/experts"}
              className={`mt-8 inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                plan.highlighted
                  ? "bg-white text-slate-900 hover:bg-slate-100"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
