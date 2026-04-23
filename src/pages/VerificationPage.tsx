import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  BadgeCheck,
  Award,
  Loader2,
  Paperclip,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { api } from "../../convex/_generated/api";
import { FileUpload, type UploadedFileMeta } from "@/components/FileUpload";

export function VerificationPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const expertProfiles = useQuery(
    api.queries.listExpertProfiles,
    session ? {} : "skip"
  );
  const requests = useQuery(
    api.verification.listMyVerificationRequests,
    session ? {} : "skip"
  );
  const badges = useQuery(
    api.verification.listMyBadges,
    session ? {} : "skip"
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

  const profile = expertProfiles?.[0] ?? null;
  const isVerified = !!profile?.isVerified;
  const pendingIdentity = requests?.find(
    (r) => r.type === "identity" && r.status === "pending"
  );
  const pendingSkill = requests?.filter(
    (r) => r.type === "skill" && r.status === "pending"
  );
  const completedRequests = requests?.filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Verification & badges
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Verified experts get the blue checkmark and show up higher in search.
          Skill badges validate specific capabilities.
        </p>
      </div>

      {!profile && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Finish your expert profile before requesting verification.{" "}
          <Link
            to="/onboarding/expert"
            className="font-semibold underline underline-offset-2"
          >
            Set up profile →
          </Link>
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${
              isVerified ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            <BadgeCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">
                Identity verification
              </h2>
              {isVerified ? (
                <StatusPill status="approved" />
              ) : pendingIdentity ? (
                <StatusPill status="pending" />
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Upload a government-issued photo ID and a selfie. Our team reviews
              within 1–2 business days. Once approved, your profile gets the
              verified checkmark.
            </p>

            {isVerified ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <ShieldCheck className="h-4 w-4" />
                Your identity has been verified.
              </div>
            ) : pendingIdentity ? (
              <PendingRequestDetail request={pendingIdentity} />
            ) : profile ? (
              <IdentitySubmitForm />
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Skill badges
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Attach proof of a specific skill — a certification, portfolio,
                or test result — and receive a validated badge on your profile.
              </p>
            </div>
          </div>
        </div>

        {badges && badges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {badges.map((b) => (
              <span
                key={b._id}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900"
              >
                <Award className="h-3 w-3" />
                {b.name}
              </span>
            ))}
          </div>
        )}

        {pendingSkill && pendingSkill.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending review
            </p>
            {pendingSkill.map((r) => (
              <PendingRequestDetail key={r._id} request={r} compact />
            ))}
          </div>
        )}

        {profile && <SkillBadgeSubmitForm />}
      </section>

      {completedRequests && completedRequests.length > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Request history
          </h2>
          <ul className="mt-3 space-y-2">
            {completedRequests.map((r) => (
              <li
                key={r._id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  {r.type === "identity" ? (
                    <BadgeCheck className="h-4 w-4" />
                  ) : (
                    <Award className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusPill status={r.status} />
                    <span className="text-sm font-semibold text-slate-900">
                      {r.type === "identity" ? "Identity" : r.skillName}
                    </span>
                  </div>
                  {r.reviewNote && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      <strong>Reviewer note:</strong> {r.reviewNote}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Reviewed {formatDate(r.reviewedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function IdentitySubmitForm() {
  const submit = useMutation(api.verification.submitVerificationRequest);
  const [note, setNote] = useState("");
  const [docs, setDocs] = useState<
    Array<UploadedFileMeta & { label: string }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const addDoc = (meta: UploadedFileMeta, label: string) => {
    setDocs((list) => [...list, { ...meta, label }]);
  };

  const onSubmit = async () => {
    setError(null);
    if (docs.length < 2) {
      setError("Please upload at least your ID and a selfie.");
      return;
    }
    setSaving(true);
    try {
      await submit({
        type: "identity",
        note: note.trim() || undefined,
        documents: docs.map((d) => ({
          storageId: d.storageId,
          fileName: d.fileName,
          label: d.label,
          contentType: d.contentType,
          size: d.size,
        })),
      });
      setSuccess(true);
      setDocs([]);
      setNote("");
    } catch (e: any) {
      setError(e?.message ?? "Could not submit");
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4" />
        Submitted. We'll email you when review is complete.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <IdentityUploadRow
        label="Government-issued photo ID (front)"
        accept="image/*,application/pdf"
        onUploaded={(meta) => addDoc(meta, "id_front")}
        attached={docs.find((d) => d.label === "id_front")}
        onRemove={() =>
          setDocs((list) => list.filter((d) => d.label !== "id_front"))
        }
      />
      <IdentityUploadRow
        label="Photo ID (back, optional)"
        accept="image/*,application/pdf"
        onUploaded={(meta) => addDoc(meta, "id_back")}
        attached={docs.find((d) => d.label === "id_back")}
        onRemove={() =>
          setDocs((list) => list.filter((d) => d.label !== "id_back"))
        }
      />
      <IdentityUploadRow
        label="Selfie holding your ID"
        accept="image/*"
        onUploaded={(meta) => addDoc(meta, "selfie")}
        attached={docs.find((d) => d.label === "selfie")}
        onRemove={() =>
          setDocs((list) => list.filter((d) => d.label !== "selfie"))
        }
      />
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Anything we should know?"
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={onSubmit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit for review
        </button>
      </div>
    </div>
  );
}

function IdentityUploadRow({
  label,
  accept,
  onUploaded,
  attached,
  onRemove,
}: {
  label: string;
  accept: string;
  onUploaded: (meta: UploadedFileMeta) => void;
  attached?: UploadedFileMeta & { label: string };
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {attached ? (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Paperclip className="h-3.5 w-3.5 text-slate-400" />
            <span className="max-w-[200px] truncate">{attached.fileName}</span>
            <button
              type="button"
              onClick={onRemove}
              className="text-slate-400 hover:text-rose-600"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <FileUpload
            compact
            accept={accept}
            label="Upload"
            maxSizeMB={15}
            onUploaded={onUploaded}
          />
        )}
      </div>
    </div>
  );
}

function SkillBadgeSubmitForm() {
  const submit = useMutation(api.verification.submitVerificationRequest);
  const [expanded, setExpanded] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [note, setNote] = useState("");
  const [docs, setDocs] = useState<UploadedFileMeta[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSkillName("");
    setNote("");
    setDocs([]);
    setError(null);
  };

  const onSubmit = async () => {
    setError(null);
    if (!skillName.trim()) {
      setError("Skill name is required");
      return;
    }
    if (docs.length === 0) {
      setError("Please attach at least one piece of evidence");
      return;
    }
    setSaving(true);
    try {
      await submit({
        type: "skill",
        skillName: skillName.trim(),
        note: note.trim() || undefined,
        documents: docs.map((d) => ({
          storageId: d.storageId,
          fileName: d.fileName,
          contentType: d.contentType,
          size: d.size,
        })),
      });
      reset();
      setExpanded(false);
    } catch (e: any) {
      setError(e?.message ?? "Could not submit");
    } finally {
      setSaving(false);
    }
  };

  if (!expanded) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Request a skill badge
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          New skill badge request
        </h3>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            reset();
          }}
          className="rounded p-1 text-slate-400 hover:bg-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Skill
          </label>
          <input
            type="text"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            placeholder="e.g. AWS Certified Solutions Architect"
            maxLength={80}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Evidence
          </label>
          <FileUpload
            accept="image/*,application/pdf"
            maxSizeMB={15}
            label="Upload evidence"
            hint="Certification doc, score report, portfolio artifact, etc."
            onUploaded={(meta) => setDocs((list) => [...list, meta])}
          />
          {docs.length > 0 && (
            <ul className="mt-2 space-y-1">
              {docs.map((d, i) => (
                <li
                  key={d.storageId}
                  className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-xs text-slate-700"
                >
                  <Paperclip className="h-3 w-3 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate">{d.fileName}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDocs((list) => list.filter((_, j) => j !== i))
                    }
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setExpanded(false);
              reset();
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

function PendingRequestDetail({
  request,
  compact,
}: {
  request: any;
  compact?: boolean;
}) {
  const cancel = useMutation(api.verification.cancelMyVerificationRequest);
  const [busy, setBusy] = useState(false);

  return (
    <div
      className={`mt-3 rounded-lg border border-amber-200 bg-amber-50 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-700" />
            <span className="text-sm font-semibold text-amber-900">
              {request.type === "identity"
                ? "Identity review in progress"
                : `Skill badge: ${request.skillName}`}
            </span>
          </div>
          <p className="mt-1 text-xs text-amber-800">
            Submitted {formatDate(request.submittedAt)}.{" "}
            {request.documents.length} document
            {request.documents.length === 1 ? "" : "s"} attached.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await cancel({ requestId: request._id });
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { label: string; class: string; Icon: any }> = {
    pending: {
      label: "Pending",
      class: "bg-amber-50 text-amber-700",
      Icon: Clock,
    },
    approved: {
      label: "Approved",
      class: "bg-emerald-50 text-emerald-700",
      Icon: CheckCircle2,
    },
    rejected: {
      label: "Rejected",
      class: "bg-rose-50 text-rose-700",
      Icon: AlertCircle,
    },
  };
  const s = styles[status] ?? styles.pending;
  const Icon = s.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.class}`}
    >
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
