import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  Shield,
  Loader2,
  BadgeCheck,
  Award,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Ban,
  UserCog,
  MessageSquare,
  Trash2,
  Download,
  FileSignature,
} from "lucide-react";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { api } from "../../convex/_generated/api";

type Tab = "overview" | "verifications" | "users" | "moderation";

export function AdminPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const amIAdmin = useQuery(api.admin.amIAdmin, session ? {} : "skip");
  const [tab, setTab] = useState<Tab>("overview");

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
  if (amIAdmin === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!amIAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Shield className="mx-auto h-8 w-8 text-slate-300" />
        <h1 className="mt-4 text-xl font-semibold text-slate-900">
          Admin access required
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          You don't have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Admin
          </h1>
          <p className="text-sm text-slate-500">
            Platform moderation & oversight
          </p>
        </div>
      </div>

      <div className="mt-6 flex gap-1 border-b border-slate-200 overflow-x-auto">
        <TabButton
          active={tab === "overview"}
          onClick={() => setTab("overview")}
        >
          Overview
        </TabButton>
        <TabButton
          active={tab === "verifications"}
          onClick={() => setTab("verifications")}
        >
          Verifications
        </TabButton>
        <TabButton active={tab === "users"} onClick={() => setTab("users")}>
          Users
        </TabButton>
        <TabButton
          active={tab === "moderation"}
          onClick={() => setTab("moderation")}
        >
          Moderation
        </TabButton>
      </div>

      <div className="mt-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "verifications" && <VerificationsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "moderation" && <ModerationTab />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative whitespace-nowrap px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? "text-slate-900"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 bg-slate-900" />
      )}
    </button>
  );
}

// -------- Overview --------

function OverviewTab() {
  const stats = useQuery(api.admin.getPlatformStats);
  const signals = useQuery(api.admin.listFraudSignals);

  if (!stats) return <LoaderBlock />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Users}
          label="Users"
          value={String(stats.users.total)}
          sublabel={`${stats.users.newLast7d} new / 7d · ${stats.users.banned} banned`}
        />
        <StatTile
          icon={BadgeCheck}
          label="Experts"
          value={`${stats.experts.verified} / ${stats.experts.total}`}
          sublabel={`${stats.experts.published} published · verified`}
        />
        <StatTile
          icon={FileSignature}
          label="Contracts"
          value={String(stats.contracts.signed)}
          sublabel={`${stats.contracts.awaitingSignature} awaiting sig · ${stats.contracts.drafts} drafts`}
        />
        <StatTile
          icon={TrendingUp}
          label="GMV paid"
          value={formatCurrency(stats.financial.gmvPaid)}
          sublabel={`${formatCurrency(stats.financial.escrowInFlight)} in escrow`}
          accent="emerald"
        />
        <StatTile
          icon={Award}
          label="Verification queue"
          value={String(stats.verification.pending)}
          sublabel={`${stats.verification.identity} identity · ${stats.verification.skill} skill`}
          accent={stats.verification.pending > 0 ? "amber" : "slate"}
        />
        <StatTile
          icon={MessageSquare}
          label="Proposals"
          value={String(stats.marketplace.proposalsSubmitted)}
          sublabel={`${stats.marketplace.proposalsAccepted} accepted`}
        />
        <StatTile
          icon={TrendingUp}
          label="Requests"
          value={String(stats.marketplace.openRequests)}
          sublabel={`${stats.marketplace.totalRequests} total posted`}
        />
        <StatTile
          icon={AlertTriangle}
          label="Stuck milestones"
          value={String(
            stats.financial.stuckSubmittedMilestones +
              stats.financial.staleApprovedMilestones
          )}
          sublabel={`${stats.financial.stuckSubmittedMilestones} unreviewed · ${stats.financial.staleApprovedMilestones} unpaid`}
          accent="rose"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Signals
        </h2>
        {!signals ? (
          <LoaderBlock />
        ) : signals.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nothing flagged right now.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {signals.map((s) => (
              <li
                key={s.id}
                className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${
                  s.severity === "high"
                    ? "border-rose-200 bg-rose-50"
                    : s.severity === "medium"
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <span
                  className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${
                    s.severity === "high"
                      ? "bg-rose-500"
                      : s.severity === "medium"
                      ? "bg-amber-500"
                      : "bg-slate-400"
                  }`}
                />
                <div>
                  <p className="font-semibold text-slate-900">{s.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{s.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// -------- Verifications --------

function VerificationsTab() {
  const pending = useQuery(api.verification.listPendingVerifications);
  const approve = useMutation(api.verification.approveVerification);
  const reject = useMutation(api.verification.rejectVerification);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!pending) return <LoaderBlock />;

  if (pending.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500" />
        <p className="mt-3 text-sm font-semibold text-slate-900">
          Queue is empty
        </p>
        <p className="mt-1 text-xs text-slate-500">
          No pending verification requests right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((r) => (
        <div
          key={r._id}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                  r.type === "identity"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {r.type === "identity" ? (
                  <BadgeCheck className="h-5 w-5" />
                ) : (
                  <Award className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {r.type === "identity"
                    ? "Identity verification"
                    : `Skill badge: ${r.skillName}`}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Submitted by {r.submitter.name}{" "}
                  {r.submitter.email && `(${r.submitter.email})`} ·{" "}
                  {formatDate(r.submittedAt)}
                </p>
                {r.note && (
                  <p className="mt-1 text-xs text-slate-600">
                    <strong>Note:</strong> {r.note}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {r.documents.map((d) => (
              <a
                key={d.storageId}
                href={d.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 transition-colors hover:bg-slate-100"
              >
                <Download className="h-3.5 w-3.5 text-slate-400" />
                <span className="min-w-0 flex-1 truncate">
                  {d.label ? `${d.label} · ` : ""}
                  {d.fileName}
                </span>
                <span className="text-[10px] uppercase text-slate-400">
                  Open
                </span>
              </a>
            ))}
          </div>

          {rejectingId === r._id && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Rejection reason (shown to the expert)
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingId(null);
                    setRejectNote("");
                    setError(null);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={acting === r._id}
                  onClick={async () => {
                    setError(null);
                    setActing(r._id);
                    try {
                      await reject({
                        requestId: r._id,
                        reviewNote: rejectNote,
                      });
                      setRejectingId(null);
                      setRejectNote("");
                    } catch (e: any) {
                      setError(e?.message ?? "Failed");
                    } finally {
                      setActing(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {acting === r._id && <Loader2 className="h-3 w-3 animate-spin" />}
                  Confirm rejection
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={acting === r._id}
              onClick={() => {
                setRejectingId(r._id);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </button>
            <button
              type="button"
              disabled={acting === r._id}
              onClick={async () => {
                setActing(r._id);
                try {
                  await approve({ requestId: r._id });
                } finally {
                  setActing(null);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {acting === r._id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// -------- Users --------

function UsersTab() {
  const [search, setSearch] = useState("");
  const data = useQuery(api.admin.listUsersPaged, { search });
  const setBanned = useMutation(api.admin.setUserBanned);
  const setRole = useMutation(api.admin.setUserRole);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!data) return <LoaderBlock />;

  const run = async (userId: string, fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(userId);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, email, or user ID"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
      />
      {error && (
        <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">User</th>
              <th className="px-4 py-2 text-left font-semibold">Role</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-left font-semibold">Joined</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {u.image ? (
                      <img
                        src={u.image}
                        alt={u.name ?? u.email}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                        {(u.name ?? u.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {u.name ?? u.email.split("@")[0]}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {u.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    disabled={busy === u.id}
                    onChange={(e) =>
                      run(u.id, () =>
                        setRole({ userId: u.id, role: e.target.value })
                      )
                    }
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="service-admin">service-admin</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-xs">
                  {u.banned ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-semibold uppercase tracking-wider text-rose-700">
                      <Ban className="h-3 w-3" /> Banned
                    </span>
                  ) : u.isAnonymous ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-wider text-slate-600">
                      anon
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold uppercase tracking-wider text-emerald-700">
                      active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {formatDate(u.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={busy === u.id}
                    onClick={() =>
                      run(u.id, () =>
                        setBanned({
                          userId: u.id,
                          banned: !u.banned,
                          reason: !u.banned ? "Admin action" : undefined,
                        })
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {busy === u.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : u.banned ? (
                      <UserCog className="h-3 w-3" />
                    ) : (
                      <Ban className="h-3 w-3" />
                    )}
                    {u.banned ? "Unban" : "Ban"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -------- Moderation --------

function ModerationTab() {
  const reviews = useQuery(api.admin.listFlaggedReviews);
  const deleteReview = useMutation(api.admin.deleteReview);
  const [busy, setBusy] = useState<string | null>(null);

  if (!reviews) return <LoaderBlock />;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">
        Low-rated reviews ({reviews.length})
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Reviews rated 2 stars or below. Delete if they violate guidelines.
      </p>
      {reviews.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500" />
          <p className="mt-3 text-sm font-semibold text-slate-900">
            Nothing flagged
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {reviews.map((r) => (
            <li
              key={r._id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                      {r.rating} / 5
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {formatDate(r.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {r.title}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                    {r.body}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    From <strong>{r.author.name}</strong> · About{" "}
                    <strong>{r.subject.name}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === r._id}
                  onClick={async () => {
                    if (!confirm("Delete this review?")) return;
                    setBusy(r._id);
                    try {
                      await deleteReview({ reviewId: r._id });
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  {busy === r._id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// -------- Shared --------

function StatTile({
  icon: Icon,
  label,
  value,
  sublabel,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  sublabel?: string;
  accent?: "emerald" | "amber" | "rose" | "slate";
}) {
  const accents: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
  };
  const color = accent ? accents[accent] : "bg-slate-100 text-slate-700";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      {sublabel && (
        <div className="mt-0.5 text-xs text-slate-500">{sublabel}</div>
      )}
    </div>
  );
}

function LoaderBlock() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
    </div>
  );
}

function formatCurrency(amount: number): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString()}`;
  }
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
