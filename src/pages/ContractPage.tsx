import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Send,
  FileSignature,
  ShieldCheck,
  Pencil,
  X as XIcon,
  Printer,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function ContractPage() {
  const { contractId } = useParams({ strict: false }) as {
    contractId: Id<"contracts">;
  };
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const contract = useQuery(
    api.contracts.getContract,
    session && contractId ? { contractId } : "skip"
  );

  if (isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!session) {
    navigate({ to: "/signin" });
    return null;
  }

  if (contract === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Contract not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          This contract may have been cancelled or you don't have access.
        </p>
        <Link
          to="/dashboard"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-900"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return <ContractView contract={contract} />;
}

function ContractView({ contract }: { contract: any }) {
  const updateDraft = useMutation(api.contracts.updateDraft);
  const sendContract = useMutation(api.contracts.sendContract);
  const cancelContract = useMutation(api.contracts.cancelContract);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: contract.title,
    scope: contract.scope,
    deliverables: contract.deliverables,
    amount: String(contract.amount),
    startDate: contract.startDate ?? "",
    endDate: contract.endDate ?? "",
    terms: contract.terms,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const onSaveDraft = () =>
    run(async () => {
      await updateDraft({
        contractId: contract._id,
        title: draft.title.trim() || undefined,
        scope: draft.scope.trim() || undefined,
        deliverables: draft.deliverables.trim() || undefined,
        amount: draft.amount ? parseFloat(draft.amount) : undefined,
        startDate: draft.startDate || undefined,
        endDate: draft.endDate || undefined,
        terms: draft.terms.trim() || undefined,
      });
      setEditing(false);
    });

  const statusBadge = statusStyles[contract.status] ?? statusStyles.draft;
  const canEdit = contract.role === "client" && contract.status === "draft";
  const canSend = contract.role === "client" && contract.status === "draft";
  const canCancel =
    contract.role === "client" &&
    (contract.status === "draft" || contract.status === "sent");
  const canSign =
    contract.status === "sent" &&
    ((contract.role === "client" && !contract.clientSignature) ||
      (contract.role === "expert" && !contract.expertSignature));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12 print:py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / export
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 print:border-b print:bg-white">
          <div>
            <div
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusBadge.badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dot}`} />
              {statusBadge.label}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {contract.title}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Statement of Work · Version {contract.version}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total value
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatCurrency(contract.amount, contract.currency)}
            </p>
            <p className="text-[11px] text-slate-500">{contract.rateType}</p>
          </div>
        </div>

        <div className="grid gap-4 border-b border-slate-100 p-6 sm:grid-cols-2 print:border-b">
          <PartyBlock label="Client" user={contract.client} />
          <PartyBlock label="Expert" user={contract.expert} />
        </div>

        <div className="space-y-6 p-6">
          {editing ? (
            <EditForm draft={draft} setDraft={setDraft} />
          ) : (
            <>
              <Section title="Scope">
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {contract.scope}
                </p>
              </Section>
              <Section title="Deliverables">
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {contract.deliverables}
                </p>
              </Section>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailBlock
                  label="Start date"
                  value={formatDate(contract.startDate)}
                />
                <DetailBlock
                  label="End date"
                  value={formatDate(contract.endDate)}
                />
              </div>
              <Section title="Terms & Conditions">
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {contract.terms}
                </p>
              </Section>
            </>
          )}

          <SignatureBlock contract={contract} />

          {contract.status === "signed" && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <ShieldCheck className="h-5 w-5" />
              <span>
                Contract executed on{" "}
                <strong>{formatDateTime(contract.executedAt)}</strong>. Both
                parties have signed.
              </span>
            </div>
          )}

          {contract.status === "cancelled" && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <AlertTriangle className="h-5 w-5" />
              This contract was cancelled and is no longer in effect.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 p-4 print:hidden">
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit draft
            </button>
          )}
          {editing && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setDraft({
                    title: contract.title,
                    scope: contract.scope,
                    deliverables: contract.deliverables,
                    amount: String(contract.amount),
                    startDate: contract.startDate ?? "",
                    endDate: contract.endDate ?? "",
                    terms: contract.terms,
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <XIcon className="h-3.5 w-3.5" />
                Cancel edits
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onSaveDraft}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save draft
              </button>
            </>
          )}
          {canSend && !editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() => sendContract({ contractId: contract._id }))
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Send to expert
            </button>
          )}
          {canCancel && !editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(() => cancelContract({ contractId: contract._id }))
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              Cancel contract
            </button>
          )}
          {canSign && !editing && (
            <SignButton contractId={contract._id} role={contract.role} />
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-slate-400 print:hidden">
        Signatures are captured in-app with your typed name, timestamp, and a
        record of your browser. For regulated industries requiring
        DocuSign/Dropbox Sign, we can route the signing step through a
        third-party signing provider — contact us to enable.
      </p>
    </div>
  );
}

function EditForm({
  draft,
  setDraft,
}: {
  draft: {
    title: string;
    scope: string;
    deliverables: string;
    amount: string;
    startDate: string;
    endDate: string;
    terms: string;
  };
  setDraft: (v: typeof draft) => void;
}) {
  return (
    <div className="space-y-4">
      <FieldGroup label="Title">
        <input
          type="text"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          maxLength={200}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </FieldGroup>
      <FieldGroup label="Scope">
        <textarea
          value={draft.scope}
          onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
          rows={5}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </FieldGroup>
      <FieldGroup label="Deliverables">
        <textarea
          value={draft.deliverables}
          onChange={(e) =>
            setDraft({ ...draft, deliverables: e.target.value })
          }
          rows={4}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </FieldGroup>
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldGroup label="Amount">
          <input
            type="number"
            min="0"
            step="any"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </FieldGroup>
        <FieldGroup label="Start date">
          <input
            type="date"
            value={draft.startDate}
            onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </FieldGroup>
        <FieldGroup label="End date">
          <input
            type="date"
            value={draft.endDate}
            onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </FieldGroup>
      </div>
      <FieldGroup label="Terms & Conditions">
        <textarea
          value={draft.terms}
          onChange={(e) => setDraft({ ...draft, terms: e.target.value })}
          rows={12}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono"
        />
      </FieldGroup>
    </div>
  );
}

function SignButton({
  contractId,
  role,
}: {
  contractId: Id<"contracts">;
  role: "client" | "expert";
}) {
  const signContract = useMutation(api.contracts.signContract);
  const [showing, setShowing] = useState(false);
  const [name, setName] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSign = async () => {
    setError(null);
    if (!ack) {
      setError("Please confirm the acknowledgement");
      return;
    }
    if (!name.trim()) {
      setError("Please type your full legal name");
      return;
    }
    setBusy(true);
    try {
      await signContract({
        contractId,
        signedName: name.trim(),
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      setShowing(false);
    } catch (e: any) {
      setError(e?.message ?? "Could not sign");
    } finally {
      setBusy(false);
    }
  };

  if (!showing) {
    return (
      <button
        type="button"
        onClick={() => setShowing(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
      >
        <FileSignature className="h-4 w-4" />
        Sign as {role}
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-4 sm:max-w-md">
      <h3 className="text-sm font-semibold text-slate-900">Sign this contract</h3>
      <p className="mt-1 text-xs text-slate-500">
        By signing, you create a legally binding agreement. A record of your
        name, the signing time, and your browser will be stored.
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            Full legal name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type your full legal name"
            maxLength={120}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-serif italic"
            style={{ fontSize: "18px" }}
          />
        </div>
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300"
          />
          <span>
            I agree to the scope, deliverables, amount, and terms in this
            contract and consent to use an electronic signature.
          </span>
        </label>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowing(false)}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSign}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Sign
          </button>
        </div>
      </div>
    </div>
  );
}

function SignatureBlock({ contract }: { contract: any }) {
  return (
    <Section title="Signatures">
      <div className="grid gap-4 sm:grid-cols-2">
        <SignatureCard
          role="Client"
          user={contract.client}
          signature={contract.clientSignature}
        />
        <SignatureCard
          role="Expert"
          user={contract.expert}
          signature={contract.expertSignature}
        />
      </div>
    </Section>
  );
}

function SignatureCard({
  role,
  user,
  signature,
}: {
  role: string;
  user: { name: string; email: string };
  signature: any;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        signature
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-dashed border-slate-300 bg-slate-50/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {role}
        </p>
        {signature ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Signed
          </span>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Pending
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900">{user.name}</p>
      {user.email && (
        <p className="text-xs text-slate-500">{user.email}</p>
      )}
      {signature ? (
        <div className="mt-3 border-t border-emerald-200 pt-3">
          <p
            className="font-serif italic text-slate-900"
            style={{ fontSize: "20px" }}
          >
            {signature.name}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Signed {formatDateTime(signature.signedAt)}
          </p>
        </div>
      ) : (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <p className="text-[11px] italic text-slate-400">
            Awaiting signature
          </p>
        </div>
      )}
    </div>
  );
}

function PartyBlock({
  label,
  user,
}: {
  label: string;
  user: { name: string; email: string; image: string | null };
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-3">
        {user.image ? (
          <img
            src={user.image}
            alt={user.name}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-semibold text-white">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-slate-900">{user.name}</p>
          {user.email && (
            <p className="text-xs text-slate-500">{user.email}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </label>
      {children}
    </div>
  );
}

const statusStyles: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  draft: {
    label: "Draft",
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
  },
  sent: {
    label: "Awaiting signature",
    badge: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  signed: {
    label: "Executed",
    badge: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
};

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

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
