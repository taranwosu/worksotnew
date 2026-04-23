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
    badge: "bg-cream-2 text-ink",
    dot: "bg-ink-40",
    icon: FileSignature,
  },
  sent: {
    label: "Awaiting signature",
    badge: "bg-sun/15 text-ink",
    dot: "bg-sun",
    icon: Clock,
  },
  signed: {
    label: "Executed",
    badge: "bg-moss/10 text-moss",
    dot: "bg-moss",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-rust/10 text-rust",
    dot: "bg-rust",
    icon: AlertCircle,
  },
};

export function ContractsSection() {
  const contracts = useQuery(api.contracts.listMyContracts);

  if (!contracts) {
    return (
      <div className="rounded-lg border border-ink-12 bg-white p-6 shadow-sm">
        <div className="h-20 animate-pulse rounded-lg bg-cream-2" />
      </div>
    );
  }

  if (contracts.length === 0) return null;

  const needingSignature = contracts.filter((c) => c.awaitingMe);

  return (
    <div className="rounded-lg border border-ink-12 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-1.5 text-lg font-semibold text-ink">
            <FileSignature className="h-4 w-4 text-ink-60" />
            Contracts
          </h3>
          <p className="mt-0.5 text-xs text-ink-60">
            Statements of Work and signed agreements.
          </p>
        </div>
        {needingSignature.length > 0 && (
          <span className="rounded-full bg-sun/25 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink">
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
                className="flex items-start gap-3 rounded-lg border border-ink-12 bg-white p-4 transition-all hover:border-ink-20 hover:shadow-md"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-cream-2 text-ink-60">
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
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-60">
                      {c.role}
                    </span>
                    {c.awaitingMe && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sun/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink">
                        Needs your signature
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-sm font-semibold text-ink">
                    {c.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-60">
                    <span>{c.counterparty.name}</span>
                    <span>·</span>
                    <span className="font-semibold text-ink">
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
