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
        <Loader2 className="h-6 w-6 animate-spin text-ink-40" />
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
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Project workspace
          </h1>
          <p className="mt-1 text-sm text-ink-60">
            Track deliverables and milestone payments for this engagement.
          </p>
        </div>
        <Link
          to="/messages"
          search={{ id: undefined, proposal: proposalId }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-20 bg-white px-3.5 py-2 text-sm font-semibold text-ink hover:bg-paper"
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

      <div className="mt-6 rounded-lg border border-ink-12 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-sun/15 text-ink">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Statement of Work
              </h3>
              <p className="mt-0.5 text-xs text-ink-60">
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-ink-2"
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-ink-2 disabled:opacity-50"
              >
                {creatingContract && <Loader2 className="h-4 w-4 animate-spin" />}
                Generate contract
              </button>
            ) : null}
          </div>
        </div>
        {contractError && (
          <p className="mt-2 text-xs text-rust">{contractError}</p>
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
              <div key={i} className="h-24 animate-pulse rounded-lg bg-cream-2" />
            ))}
          </div>
        ) : milestones.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink-20 bg-paper/50 p-8 text-center">
            <CircleDollarSign className="mx-auto h-6 w-6 text-ink-40" />
            <h3 className="mt-3 text-sm font-semibold text-ink">
              No milestones yet
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-60">
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
        <p className="mt-8 text-center text-xs text-ink-40">
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
      className={`rounded-lg border p-4 shadow-sm ${
        accent === "emerald"
          ? "border-moss/40 bg-moss/10"
          : "border-ink-12 bg-white"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-60">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold ${accent === "emerald" ? "text-moss" : "text-ink"}`}>
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
        className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-ink-2"
      >
        <Plus className="h-4 w-4" />
        Add milestone
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-ink-12 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">New milestone</h3>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            reset();
          }}
          className="rounded p-1 text-ink-40 hover:bg-cream-2"
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
          className="w-full rounded-lg border border-ink-12 bg-white px-3 py-2 text-sm"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Deliverables & acceptance criteria (optional)"
          rows={3}
          className="w-full resize-none rounded-lg border border-ink-12 bg-white px-3 py-2 text-sm"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-60">
              Amount ({currency})
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-40">
                $
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-ink-12 bg-white py-2 pl-7 pr-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-60">
              Due date (optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-ink-12 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
        {error && <p className="text-xs text-rust">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              reset();
            }}
            disabled={saving}
            className="rounded-lg border border-ink-20 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-paper"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-2 disabled:opacity-50"
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
    <div className="rounded-lg border border-ink-12 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cream-2 text-xs font-semibold text-ink">
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
            <span className="text-xs font-semibold text-ink">
              {formatCurrency(milestone.amount, milestone.currency)}
            </span>
            {milestone.dueDate && (
              <span className="flex items-center gap-1 text-xs text-ink-60">
                <Calendar className="h-3 w-3" />
                {new Date(milestone.dueDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-semibold text-ink">{milestone.title}</h3>
          {milestone.description && (
            <p className="mt-1 text-sm text-ink-60">
              {milestone.description}
            </p>
          )}
          {(milestone.deliverableNote ||
            (milestone.attachments && milestone.attachments.length > 0)) && (
            <div className="mt-2 rounded-lg border border-ink-12 bg-paper p-3 text-xs text-ink-60">
              <p className="font-semibold text-ink">Expert submission</p>
              {milestone.deliverableNote && (
                <p className="mt-1 whitespace-pre-wrap">
                  {milestone.deliverableNote}
                </p>
              )}
              {milestone.attachments && milestone.attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {milestone.attachments.map((att: any) => (
                    <li key={att.storageId} className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-ink-40" />
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {att.fileName}
                        {att.size ? ` · ${formatFileSize(att.size)}` : ""}
                      </span>
                      {att.url && (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-ink-12 bg-white px-2 py-0.5 text-[10px] font-semibold text-ink hover:bg-paper"
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-2"
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-moss px-3 py-1.5 text-xs font-semibold text-white hover:bg-moss"
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-2"
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-20 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
                >
                  Cancel
                </button>
              )}
          </div>

          {showSubmit && (
            <div className="mt-3 rounded-lg border border-ink-12 bg-paper p-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-60">
                Submission note
              </label>
              <textarea
                value={deliverableNote}
                onChange={(e) => setDeliverableNote(e.target.value)}
                placeholder="Summarise what you delivered"
                rows={3}
                className="w-full resize-none rounded-lg border border-ink-12 bg-white px-3 py-2 text-sm"
              />
              <label className="mb-1 mt-3 block text-xs font-semibold uppercase tracking-wider text-ink-60">
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
                      className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-xs text-ink"
                    >
                      <Paperclip className="h-3 w-3 text-ink-40" />
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
                        className="text-ink-40 hover:text-rust"
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
                  className="rounded-lg border border-ink-20 bg-white px-3 py-1 text-xs font-semibold text-ink"
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1 text-xs font-semibold text-white"
                >
                  {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                  Submit
                </button>
              </div>
            </div>
          )}

          {error && <p className="mt-2 text-xs text-rust">{error}</p>}
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
    badge: "bg-cream-2 text-ink",
    dot: "bg-ink-40",
  },
  submitted: {
    label: "Awaiting review",
    badge: "bg-sun/15 text-ink",
    dot: "bg-sun",
  },
  approved: {
    label: "Approved",
    badge: "bg-sun/15 text-ink",
    dot: "bg-ink",
  },
  paid: {
    label: "Paid",
    badge: "bg-moss/10 text-moss",
    dot: "bg-moss",
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-rust/10 text-rust",
    dot: "bg-rust",
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
