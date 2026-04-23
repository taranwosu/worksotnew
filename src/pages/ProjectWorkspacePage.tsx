import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Loader2,
  Plus,
  CheckCircle2,
  Upload,
  CreditCard,
  X,
  MessageSquare,
  CircleDollarSign,
  Calendar,
  FileSignature,
  Paperclip,
  Download,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FileUpload, type UploadedFileMeta } from "@/components/FileUpload";

export function ProjectWorkspacePage() {
  const { proposalId } = useParams({ strict: false }) as {
    proposalId: Id<"proposals">;
  };
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  const milestones = useQuery(
    api.milestones.listMilestones,
    session && proposalId ? { proposalId } : "skip"
  );
  const contractRef = useQuery(
    api.contracts.getContractByProposal,
    session && proposalId ? { proposalId } : "skip"
  );
  const generateContract = useMutation(api.contracts.generateFromProposal);
  const navigateTo = useNavigate();
  const [creatingContract, setCreatingContract] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);

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

  const role = milestones?.[0]?.role ?? null;
  const total = milestones?.reduce((s, m) => s + m.amount, 0) ?? 0;
  const paid =
    milestones
      ?.filter((m) => m.status === "paid")
      .reduce((s, m) => s + m.amount, 0) ?? 0;
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const currency = milestones?.[0]?.currency ?? "USD";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Project workspace
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track deliverables and milestone payments for this engagement.
          </p>
        </div>
        <Link
          to="/messages"
          search={{ id: undefined, proposal: proposalId }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <MessageSquare className="h-4 w-4" />
          Open thread
        </Link>
      </div>

      {milestones && milestones.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Total value"
            value={formatCurrency(total, currency)}
          />
          <StatTile
            label="Paid"
            value={formatCurrency(paid, currency)}
            accent="emerald"
          />
          <StatTile label="Progress" value={`${pct}%`} />
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Statement of Work
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {contractRef
                  ? contractRef.status === "signed"
                    ? "Contract executed by both parties."
                    : contractRef.status === "sent"
                    ? "Awaiting signatures."
                    : contractRef.status === "cancelled"
                    ? "Contract cancelled."
                    : "Draft — review before sending."
                  : role === "client"
                  ? "Generate a contract pre-filled from this proposal. You can edit before sending."
                  : "No contract yet — the client can generate one from their side."}
              </p>
            </div>
          </div>
          <div>
            {contractRef ? (
              <Link
                to="/contracts/$contractId"
                params={{ contractId: contractRef._id }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Open contract
              </Link>
            ) : role === "client" ? (
              <button
                type="button"
                disabled={creatingContract}
                onClick={async () => {
                  setContractError(null);
                  setCreatingContract(true);
                  try {
                    const id = await generateContract({ proposalId });
                    navigateTo({
                      to: "/contracts/$contractId",
                      params: { contractId: id },
                    });
                  } catch (e: any) {
                    setContractError(e?.message ?? "Could not generate contract");
                  } finally {
                    setCreatingContract(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                {creatingContract && <Loader2 className="h-4 w-4 animate-spin" />}
                Generate contract
              </button>
            ) : null}
          </div>
        </div>
        {contractError && (
          <p className="mt-2 text-xs text-rose-600">{contractError}</p>
        )}
      </div>

      {role === "client" && (
        <div className="mt-6">
          <CreateMilestoneForm proposalId={proposalId} currency={currency} />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {!milestones ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : milestones.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
            <CircleDollarSign className="mx-auto h-6 w-6 text-slate-400" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900">
              No milestones yet
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
              {role === "client"
                ? "Break the project into milestones with clear deliverables and amounts. Experts submit work and you approve & pay per milestone."
                : "The client hasn't added milestones yet. Once they do, you'll be able to submit deliverables here."}
            </p>
          </div>
        ) : (
          milestones.map((m, i) => (
            <MilestoneCard key={m._id} milestone={m} index={i} />
          ))
        )}
      </div>

      {milestones && milestones.length > 0 && (
        <p className="mt-8 text-center text-xs text-slate-400">
          Marking a milestone as paid is a manual confirmation for now. In-platform
          payments via Stripe Connect are coming next.
        </p>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        accent === "emerald"
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold ${accent === "emerald" ? "text-emerald-900" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}

function CreateMilestoneForm({
  proposalId,
  currency,
}: {
  proposalId: Id<"proposals">;
  currency: string;
}) {
  const createMilestone = useMutation(api.milestones.createMilestone);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setAmount("");
    setDueDate("");
    setError(null);
  };

  const onCreate = async () => {
    setError(null);
    const amt = parseFloat(amount);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!amt || amt <= 0) {
      setError("Amount must be greater than zero");
      return;
    }
    setSaving(true);
    try {
      await createMilestone({
        proposalId,
        title: title.trim(),
        description: description.trim() || undefined,
        amount: amt,
        currency,
        dueDate: dueDate || undefined,
      });
      reset();
      setExpanded(false);
    } catch (e: any) {
      setError(e?.message ?? "Could not add milestone");
    } finally {
      setSaving(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
      >
        <Plus className="h-4 w-4" />
        Add milestone
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">New milestone</h3>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            reset();
          }}
          className="rounded p-1 text-slate-400 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Milestone title (e.g. 'Design mockups')"
          maxLength={120}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Deliverables & acceptance criteria (optional)"
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Amount ({currency})
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                $
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Due date (optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              reset();
            }}
            disabled={saving}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add milestone
          </button>
        </div>
      </div>
    </div>
  );
}

function MilestoneCard({
  milestone,
  index,
}: {
  milestone: any;
  index: number;
}) {
  const submit = useMutation(api.milestones.submitMilestone);
  const approve = useMutation(api.milestones.approveMilestone);
  const pay = useMutation(api.milestones.markMilestonePaid);
  const cancel = useMutation(api.milestones.cancelMilestone);
  const [deliverableNote, setDeliverableNote] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<UploadedFileMeta[]>([]);
  const [showSubmit, setShowSubmit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAction = async (fn: () => Promise<unknown>) => {
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

  const { status, role } = milestone;
  const statusMeta = statusLabels[status] ?? statusLabels.pending;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusMeta.badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
              {statusMeta.label}
            </span>
            <span className="text-xs font-semibold text-slate-700">
              {formatCurrency(milestone.amount, milestone.currency)}
            </span>
            {milestone.dueDate && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="h-3 w-3" />
                {new Date(milestone.dueDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-semibold text-slate-900">{milestone.title}</h3>
          {milestone.description && (
            <p className="mt-1 text-sm text-slate-600">
              {milestone.description}
            </p>
          )}
          {(milestone.deliverableNote ||
            (milestone.attachments && milestone.attachments.length > 0)) && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">Expert submission</p>
              {milestone.deliverableNote && (
                <p className="mt-1 whitespace-pre-wrap">
                  {milestone.deliverableNote}
                </p>
              )}
              {milestone.attachments && milestone.attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {milestone.attachments.map((att: any) => (
                    <li key={att.storageId} className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-slate-700">
                        {att.fileName}
                        {att.size ? ` · ${formatFileSize(att.size)}` : ""}
                      </span>
                      {att.url && (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {role === "expert" && status === "pending" && (
              <button
                type="button"
                onClick={() => setShowSubmit(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Upload className="h-3.5 w-3.5" />
                Submit for review
              </button>
            )}
            {role === "client" && status === "submitted" && (
              <button
                type="button"
                onClick={() =>
                  runAction(() => approve({ milestoneId: milestone._id }))
                }
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </button>
            )}
            {role === "client" && status === "approved" && (
              <button
                type="button"
                onClick={() =>
                  runAction(() => pay({ milestoneId: milestone._id }))
                }
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Mark paid
              </button>
            )}
            {role === "client" &&
              (status === "pending" || status === "submitted") && (
                <button
                  type="button"
                  onClick={() =>
                    runAction(() => cancel({ milestoneId: milestone._id }))
                  }
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
          </div>

          {showSubmit && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Submission note
              </label>
              <textarea
                value={deliverableNote}
                onChange={(e) => setDeliverableNote(e.target.value)}
                placeholder="Summarise what you delivered"
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <label className="mb-1 mt-3 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Attachments
              </label>
              <FileUpload
                compact
                label="Attach file"
                maxSizeMB={25}
                onUploaded={(meta) =>
                  setPendingAttachments((list) => [...list, meta])
                }
              />
              {pendingAttachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {pendingAttachments.map((att, i) => (
                    <li
                      key={att.storageId}
                      className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      <Paperclip className="h-3 w-3 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate">
                        {att.fileName}
                        {att.size ? ` · ${formatFileSize(att.size)}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingAttachments((list) =>
                            list.filter((_, j) => j !== i)
                          )
                        }
                        className="text-slate-400 hover:text-rose-600"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubmit(false);
                    setDeliverableNote("");
                    setPendingAttachments([]);
                  }}
                  disabled={busy}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await runAction(() =>
                      submit({
                        milestoneId: milestone._id,
                        deliverableNote: deliverableNote.trim() || undefined,
                        attachments:
                          pendingAttachments.length > 0
                            ? pendingAttachments.map((a) => ({
                                storageId: a.storageId,
                                fileName: a.fileName,
                                contentType: a.contentType,
                                size: a.size,
                              }))
                            : undefined,
                      })
                    );
                    setShowSubmit(false);
                    setDeliverableNote("");
                    setPendingAttachments([]);
                  }}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                >
                  {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                  Submit
                </button>
              </div>
            </div>
          )}

          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

const statusLabels: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  pending: {
    label: "Pending",
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
  },
  submitted: {
    label: "Awaiting review",
    badge: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    badge: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  paid: {
    label: "Paid",
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
