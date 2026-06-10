import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Play, Upload, Package, X } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import {
  fetchPoolTask,
  startPoolTask,
  submitPoolDeliverable,
  addPoolTaskComment,
  uploadFile,
  type PoolTaskDetail,
} from "@/lib/api";
import { Container, Button, Tag } from "@/components/primitives";
import { TaskStatusBadge } from "@/components/managed/TaskStatusBadge";
import { TaskActivityFeed } from "@/components/managed/TaskActivityFeed";
import { AttachmentList } from "@/components/managed/DeliverableList";
import { usePageMeta } from "@/lib/seo";

export function PoolTaskDetailPage() {
  const { taskId } = useParams({ strict: false }) as { taskId: string };
  usePageMeta({ title: "Pool task", path: `/pool/tasks/${taskId}`, robots: "noindex,nofollow" });
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<PoolTaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/signin" });
  }, [isPending, session, navigate]);

  const load = useCallback(() => {
    fetchPoolTask(taskId)
      .then((d) => { setDetail(d); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load task"));
  }, [taskId]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  if (isPending || !session || (!detail && !error)) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-40" /></div>;
  }

  if (error || !detail) {
    return (
      <div className="bg-cream pb-24 pt-16">
        <Container>
          <p className="text-ink-60">{error ?? "Task not found."}</p>
          <Link to="/pool/tasks" className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-ink hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to my tasks
          </Link>
        </Container>
      </div>
    );
  }

  const t = detail.task;
  const canSubmit = ["in_progress", "revision_requested"].includes(t.status);
  const rejected = detail.deliverables.filter((d) => d.status === "rejected");
  const latestRejected = rejected.length > 0 ? rejected[rejected.length - 1] : null;

  const start = async () => {
    setBusy(true);
    try {
      await startPoolTask(t.id);
      toast.success("Marked in progress — good luck!");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-cream pb-24 pt-12 md:pt-16">
      <Container>
        <Link to="/pool/tasks" className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-60 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to my tasks
        </Link>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <TaskStatusBadge status={t.status} size="md" />
              {t.priority === "high" && <Tag tone="rust" size="sm">high priority</Tag>}
            </div>
            <h1 className="mt-3 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-medium leading-[1.08] tracking-[-0.02em] text-ink">
              {t.title}
            </h1>
            <p className="mt-2 font-mono text-[11.5px] text-ink-40">
              {t.company_name ?? "Client"} · assigned {t.assigned_at ? new Date(t.assigned_at).toLocaleDateString() : "—"}
              {t.due_date ? ` · due ${new Date(t.due_date).toLocaleDateString()}` : ""}
            </p>
          </div>
          {t.status === "assigned" && (
            <Button tone="ink" size="sm" disabled={busy} onClick={start} data-testid="pool-start">
              <Play className="h-3.5 w-3.5" /> Start work
            </Button>
          )}
        </div>

        {t.status === "revision_requested" && latestRejected?.review_note && (
          <div className="mt-5 rounded border border-rust/40 bg-rust/5 p-4">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-rust">Changes requested</p>
            <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] text-ink">{latestRejected.review_note}</p>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Card title="Brief">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{t.description}</p>
              {detail.attachments.length > 0 && (
                <div className="mt-4"><AttachmentList files={detail.attachments} /></div>
              )}
            </Card>

            {canSubmit && <SubmitForm taskId={t.id} version={detail.deliverables.length + 1} onSubmitted={load} />}

            {detail.deliverables.length > 0 && (
              <Card title="Your submissions">
                <div className="space-y-4">
                  {[...detail.deliverables].reverse().map((d) => (
                    <div key={d.id} className="rounded border border-ink-12 p-4">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
                          <Package className="h-3.5 w-3.5" /> v{d.version} · {new Date(d.created_at).toLocaleDateString()}
                        </p>
                        <Tag tone={d.status === "approved" ? "moss" : d.status === "rejected" ? "rust" : "sun"} size="sm">
                          {d.status === "pending_review" ? "in review" : d.status}
                        </Tag>
                      </div>
                      {d.note && <p className="mt-2 whitespace-pre-wrap text-[13px] text-ink">{d.note}</p>}
                      {d.review_note && d.status === "rejected" && (
                        <p className="mt-2 text-[12.5px] text-ink-60">Reviewer: {d.review_note}</p>
                      )}
                      <div className="mt-3"><AttachmentList files={d.files ?? []} /></div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <Card title="Activity">
            <TaskActivityFeed
              events={detail.events}
              canPostInternal
              onPost={async (body, visibility) => {
                await addPoolTaskComment(t.id, body, visibility);
                load();
              }}
            />
          </Card>
        </div>
      </Container>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-ink-12 bg-white p-5">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SubmitForm({ taskId, version, onSubmitted }: { taskId: string; version: number; onSubmitted: () => void }) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (files.length === 0) return;
    setBusy(true);
    try {
      const ids: string[] = [];
      for (const f of files) {
        const meta = await uploadFile(f, { managed_task_id: taskId });
        ids.push(meta.id);
      }
      await submitPoolDeliverable(taskId, { note: note || undefined, file_ids: ids });
      toast.success("Submitted for review — the WorkSoy team will take a look");
      setNote("");
      setFiles([]);
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border border-ink bg-white p-5" data-testid="pool-submit-form">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
        Submit deliverable v{version}
      </p>
      <p className="mt-1 text-[12.5px] text-ink-60">
        Goes to the WorkSoy review team first — not directly to the client.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="What's included, decisions made, anything the reviewer should know…"
        data-testid="pool-deliverable-note"
        className="mt-3 w-full rounded border border-ink-20 bg-white px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-40 focus:border-ink focus:outline-none"
      />
      <div className="mt-3">
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          data-testid="pool-deliverable-files"
          className="w-full rounded border border-ink-20 bg-white px-3 py-2 text-[13px] text-ink file:mr-3 file:rounded file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-cream"
        />
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-[12px] text-ink-60">
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="text-ink-40 hover:text-ink">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button tone="ink" size="sm" className="mt-4" disabled={busy || files.length === 0} onClick={submit} data-testid="pool-deliverable-submit">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Submit for review
      </Button>
    </div>
  );
}
