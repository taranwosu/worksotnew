import { useEffect, useState } from "react";
import { Loader2, ChevronRight, Star, CheckCircle2, X, Pause, Play, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  adminListManagedTasks,
  adminGetManagedTask,
  adminAcceptTask,
  adminAssignTask,
  adminUnassignTask,
  adminHoldTask,
  adminResumeTask,
  adminCancelTask,
  adminCompleteTask,
  adminReviewDeliverable,
  adminRateManagedTask,
  adminManagedTaskComment,
  adminUpdateTaskNotes,
  adminListPool,
  type ManagedTaskRow,
  type AdminManagedTaskDetail,
  type PoolMemberRow,
} from "@/lib/api";
import { Button, Tag } from "@/components/primitives";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskActivityFeed } from "./TaskActivityFeed";
import { AttachmentList } from "./DeliverableList";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { key: "", label: "All open" },
  { key: "requested", label: "Requested" },
  { key: "accepted", label: "Queued" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In progress" },
  { key: "submitted", label: "Needs review" },
  { key: "revision_requested", label: "Revisions" },
  { key: "delivered", label: "Delivered" },
  { key: "on_hold", label: "On hold" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

const CLOSED = new Set(["completed", "cancelled"]);

export function AdminTaskBoard({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<ManagedTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminListManagedTasks(filter ? { status: filter } : {}));
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filter]);

  const changed = () => { load(); onChanged?.(); };

  const shown = filter ? rows : rows.filter((r) => !CLOSED.has(r.task.status));

  return (
    <div data-testid="admin-task-board">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            data-testid={`task-filter-${f.key || "open"}`}
            className={cn(
              "rounded-pill border px-3 py-1.5 text-[12px] font-medium",
              filter === f.key ? "border-sun bg-sun/15 text-cream" : "border-cream/15 text-cream/60 hover:text-cream",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-cream/40" /></div>
      ) : shown.length === 0 ? (
        <div className="mt-6 rounded border border-cream/10 p-8 text-center text-[13px] text-cream/60">
          No tasks here.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {shown.map((r) => (
            <div key={r.task.id} className="rounded border border-cream/10 bg-ink-2" data-testid={`managed-task-${r.task.id}`}>
              <button
                onClick={() => setOpenId((p) => (p === r.task.id ? null : r.task.id))}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-[14px] font-semibold text-cream">{r.task.title}</p>
                  <p className="truncate text-[11.5px] text-cream/60">
                    {r.company_name ?? "—"}
                    {r.assignee_name ? ` · assigned to ${r.assignee_name}` : " · unassigned"}
                    {r.task.due_date ? ` · due ${new Date(r.task.due_date).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.task.priority === "high" && <Tag tone="rust" size="sm">high</Tag>}
                  <TaskStatusBadge status={r.task.status} />
                  <ChevronRight className={cn("h-4 w-4 text-cream/50 transition-transform", openId === r.task.id && "rotate-90")} />
                </div>
              </button>
              {openId === r.task.id && <TaskDetail taskId={r.task.id} onChanged={changed} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskDetail({ taskId, onChanged }: { taskId: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<AdminManagedTaskDetail | null>(null);
  const [pool, setPool] = useState<PoolMemberRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => {
    adminGetManagedTask(taskId).then(setDetail).catch(() => setDetail(null));
  };
  useEffect(() => {
    load();
    adminListPool("active").then(setPool).catch(() => setPool([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  if (!detail) {
    return <div className="border-t border-cream/10 p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-cream/40" /></div>;
  }

  const t = detail.task;
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const pendingDeliverable = detail.deliverables.find((d) => d.status === "pending_review");

  return (
    <div className="space-y-4 border-t border-cream/10 p-5 text-[13px] text-cream/85">
      <Section title="Request">
        <p className="whitespace-pre-wrap text-cream/90">{t.description}</p>
        {detail.attachments.length > 0 && (
          <div className="mt-3"><AttachmentList files={detail.attachments} theme="ink" /></div>
        )}
        <p className="mt-3 text-[11.5px] text-cream/50">
          {detail.client?.company_name} · requested {new Date(t.created_at).toLocaleDateString()}
          {detail.assignee && (
            <> · assignee cost ${detail.assignee.member.cost_rate}/{detail.assignee.member.cost_rate_type === "hourly" ? "hr" : "task"}</>
          )}
        </p>
      </Section>

      {/* Lifecycle actions */}
      <Section title="Actions">
        <div className="flex flex-wrap gap-2">
          {t.status === "requested" && (
            <Button tone="sun" size="sm" disabled={busy} onClick={() => run(() => adminAcceptTask(t.id), "Task accepted")} data-testid={`task-accept-${t.id}`}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Accept into queue
            </Button>
          )}
          {t.status === "assigned" && (
            <Button tone="outline" size="sm" disabled={busy} onClick={() => run(() => adminUnassignTask(t.id), "Unassigned")} data-testid={`task-unassign-${t.id}`}>
              Unassign
            </Button>
          )}
          {t.status === "delivered" && (
            <Button tone="sun" size="sm" disabled={busy} onClick={() => run(() => adminCompleteTask(t.id), "Task completed")} data-testid={`task-complete-${t.id}`}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark completed
            </Button>
          )}
          {["accepted", "assigned", "in_progress", "revision_requested"].includes(t.status) && (
            <Button tone="outline" size="sm" disabled={busy} onClick={() => run(() => adminHoldTask(t.id), "Task on hold")} data-testid={`task-hold-${t.id}`}>
              <Pause className="h-3.5 w-3.5" /> Hold
            </Button>
          )}
          {t.status === "on_hold" && (
            <Button tone="sun" size="sm" disabled={busy} onClick={() => run(() => adminResumeTask(t.id), "Task resumed")} data-testid={`task-resume-${t.id}`}>
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          )}
          {!CLOSED.has(t.status) && (
            <Button tone="outline" size="sm" disabled={busy} onClick={() => run(() => adminCancelTask(t.id), "Task cancelled")} data-testid={`task-cancel-${t.id}`}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}
        </div>

        {t.status === "accepted" && (
          <AssignPicker pool={pool} busy={busy} onAssign={(pmId) => run(() => adminAssignTask(t.id, pmId), "Assigned")} />
        )}
      </Section>

      {/* Deliverable review */}
      {pendingDeliverable && (
        <DeliverableReview deliverable={pendingDeliverable} busy={busy} onReview={(action, note) =>
          run(() => adminReviewDeliverable(pendingDeliverable.id, action, note), action === "approve" ? "Released to client" : "Sent back for revision")
        } />
      )}
      {detail.deliverables.filter((d) => d.status !== "pending_review").map((d) => (
        <Section key={d.id} title={`Deliverable v${d.version} · ${d.status}`}>
          {d.note && <p className="whitespace-pre-wrap text-cream/80">{d.note}</p>}
          {d.review_note && <p className="mt-1 text-[12px] text-cream/60">Review note: {d.review_note}</p>}
          <div className="mt-2"><AttachmentList files={d.files ?? []} theme="ink" /></div>
        </Section>
      ))}

      {/* Performance rating */}
      {t.status === "completed" && !detail.rating && detail.assignee && (
        <RateForm busy={busy} onRate={(score, notes) => run(() => adminRateManagedTask(t.id, score, notes), "Performance recorded")} />
      )}
      {detail.rating && (
        <Section title="Performance rating">
          <p className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-sun" /> {detail.rating.score}/5
            {detail.rating.notes ? <span className="text-cream/60"> — {detail.rating.notes}</span> : null}
          </p>
        </Section>
      )}

      {/* Internal notes */}
      <NotesEditor taskId={t.id} initial={t.admin_notes ?? ""} onSaved={load} />

      {/* Activity */}
      <Section title="Activity">
        <TaskActivityFeed
          events={detail.events}
          theme="ink"
          canPostInternal
          onPost={async (body, visibility) => {
            await adminManagedTaskComment(t.id, body, visibility);
            load();
          }}
        />
      </Section>
    </div>
  );
}

function AssignPicker({
  pool,
  busy,
  onAssign,
}: {
  pool: PoolMemberRow[];
  busy: boolean;
  onAssign: (poolMemberId: string) => void;
}) {
  const [selected, setSelected] = useState("");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        data-testid="task-assign-select"
        className="h-9 rounded border border-cream/15 bg-ink px-3 text-[13px] text-cream"
      >
        <option value="">Choose a pool freelancer…</option>
        {pool.map((p) => (
          <option key={p.member.id} value={p.member.id}>
            {p.user?.name ?? p.member.user_id}
            {p.expert ? ` — ${p.expert.category}` : ""}
            {` ($${p.member.cost_rate}/${p.member.cost_rate_type === "hourly" ? "hr" : "task"}${p.member.performance_count > 0 ? `, ★${p.member.performance_score.toFixed(1)}` : ""})`}
            {p.open_tasks > 0 ? ` · ${p.open_tasks} open` : ""}
          </option>
        ))}
      </select>
      <Button tone="sun" size="sm" disabled={busy || !selected} onClick={() => onAssign(selected)} data-testid="task-assign-confirm">
        <UserPlus className="h-3.5 w-3.5" /> Assign
      </Button>
    </div>
  );
}

function DeliverableReview({
  deliverable,
  busy,
  onReview,
}: {
  deliverable: { id: string; version: number; note?: string | null; files?: { id: string; filename: string; size: number; content_type: string }[] };
  busy: boolean;
  onReview: (action: "approve" | "reject", note?: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Section title={`Review deliverable v${deliverable.version}`}>
      {deliverable.note && <p className="whitespace-pre-wrap text-cream/90">{deliverable.note}</p>}
      <div className="mt-2"><AttachmentList files={deliverable.files ?? []} theme="ink" /></div>
      <label className="mt-3 block text-[11px] uppercase tracking-[0.14em] text-cream/60">Review note</label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Approve: shared with the client. Reject: sent to the freelancer (required)."
        data-testid={`review-note-${deliverable.id}`}
        className="mt-1 w-full rounded border border-cream/15 bg-ink px-3 py-2 text-[13px] text-cream placeholder:text-cream/40"
      />
      <div className="mt-3 flex gap-2">
        <Button tone="sun" size="sm" disabled={busy} onClick={() => onReview("approve", note || undefined)} data-testid={`review-approve-${deliverable.id}`}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve & release to client
        </Button>
        <Button tone="outline" size="sm" disabled={busy || !note.trim()} onClick={() => onReview("reject", note)} data-testid={`review-reject-${deliverable.id}`}>
          <X className="h-3.5 w-3.5" /> Request changes
        </Button>
      </div>
    </Section>
  );
}

function RateForm({ busy, onRate }: { busy: boolean; onRate: (score: number, notes?: string) => void }) {
  const [score, setScore] = useState(0);
  const [notes, setNotes] = useState("");
  return (
    <Section title="Rate the freelancer (internal)">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setScore(n)} aria-label={`${n} stars`} data-testid={`rate-star-${n}`}>
            <Star className={cn("h-5 w-5", n <= score ? "fill-sun text-sun" : "text-cream/30")} />
          </button>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Internal performance notes — never shown to the client or freelancer."
        className="mt-2 w-full rounded border border-cream/15 bg-ink px-3 py-2 text-[13px] text-cream placeholder:text-cream/40"
        data-testid="rate-notes"
      />
      <Button tone="sun" size="sm" className="mt-2" disabled={busy || score === 0} onClick={() => onRate(score, notes || undefined)} data-testid="rate-submit">
        Save rating
      </Button>
    </Section>
  );
}

function NotesEditor({ taskId, initial, onSaved }: { taskId: string; initial: string; onSaved: () => void }) {
  const [notes, setNotes] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await adminUpdateTaskNotes(taskId, notes);
      toast.success("Notes saved");
      onSaved();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Internal notes (admin only)">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        data-testid={`task-notes-${taskId}`}
        className="w-full rounded border border-cream/15 bg-ink px-3 py-2 text-[13px] text-cream"
      />
      <Button tone="outline" size="sm" className="mt-2" disabled={busy} onClick={save}>
        Save notes
      </Button>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-cream/10 bg-ink p-4">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-cream/60">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
