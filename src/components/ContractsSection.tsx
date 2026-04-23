import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FileSignature, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { api } from "../../convex/_generated/api";

const STATUS_META: Record<
  string,
  { label: string; badge: string; dot: string; icon: any }
> = {
  draft: {
    label: "Draft",
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
    icon: FileSignature,
  },
  sent: {
    label: "Awaiting signature",
    badge: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    icon: Clock,
  },
  signed: {
    label: "Executed",
    badge: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
    icon: AlertCircle,
  },
};

export function ContractsSection() {
  const contracts = useQuery(api.contracts.listMyContracts);

  if (!contracts) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  if (contracts.length === 0) return null;

  const needingSignature = contracts.filter((c) => c.awaitingMe);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-1.5 text-lg font-semibold text-slate-900">
            <FileSignature className="h-4 w-4 text-slate-500" />
            Contracts
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Statements of Work and signed agreements.
          </p>
        </div>
        {needingSignature.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
            {needingSignature.length} awaiting you
          </span>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {contracts.map((c) => {
          const meta = STATUS_META[c.status] ?? STATUS_META.draft;
          const Icon = meta.icon;
          return (
            <li key={c._id}>
              <Link
                to="/contracts/$contractId"
                params={{ contractId: c._id }}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {c.role}
                    </span>
                    {c.awaitingMe && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                        Needs your signature
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">
                    {c.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    <span>{c.counterparty.name}</span>
                    <span>·</span>
                    <span className="font-semibold text-slate-700">
                      {formatCurrency(c.amount, c.currency)}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}
