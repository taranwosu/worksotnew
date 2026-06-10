import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Package, CheckCircle2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import {
  fetchManagedTask,
  cancelManagedTask,
  requestTaskRevision,
  confirmTaskCompletion,
  addManagedTaskComment,
  type ClientTaskDetail,
} from "@/lib/api";
import { Container, Button, Tag } from "@/components/primitives";
import { TaskStatusBadge } from "@/components/managed/TaskStatusBadge";
import { TaskActivityFeed } from "@/components/managed/TaskActivityFeed";
import { AttachmentList } from "@/components/managed/DeliverableList";
import { usePageMeta } from "@/lib/seo";

export function ClientTaskDetailPage() {
  const { taskId } = useParams({ strict: false }) as { taskId: string };
  usePageMeta({ title: "Task", path: `/portal/tasks/${taskId}`, robots: "noindex,nofollow" });
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [task, setTask] = useState<ClientTaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revising, setRevising] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/signin" });
  }, [isPending, session, navigate]);

  const load = useCallback(() => {
    fetchManagedTask(taskId)
      .then((t) => { setTask(t); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load task"));
  }, [taskId]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  if (isPending || !session || (!task && !error)) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-40" /></div>;
  }

  if (error || !task) {
    return (
      <div className="bg-cream pb-24 pt-16">
        <Container>
          <p className="text-ink-60">{error ?? "Task not found."}</p>
          <Link to="/portal" className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-ink hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to portal
          </Link>
        </Container>
      </div>
    );
  }

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-cream pb-24 pt-12 md:pt-16">
      <Container>
        <Link to="/portal" className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-60 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to portal
        </Link>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <TaskStatusBadge status={task.status} size="md" />
              {task.priority === "high" && <Tag tone="rust" size="sm">high priority</Tag>}
            </div>
            <h1 className="mt-3 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-medium leading-[1.08] tracking-[-0.02em] text-ink">
              {task.title}
            </h1>
            <p className="mt-2 font-mono text-[11.5px] text-ink-40">
              Submitted {new Date(task.created_at).toLocaleDateString()}
              {task.assignee_name ? ` · with ${task.assignee_name}` : ""}
              {task.due_date ? ` · needed by ${new Date(task.due_date).toLocaleDateString()}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {task.status === "requested" && (
              <Button tone="outline" size="sm" disabled={busy} onClick={() => run(() => cancelManagedTask(task.id), "Request withdrawn")} data-testid="portal-cancel">
                <X className="h-3.5 w-3.5" /> Withdraw request
              </Button>
            )}
            {task.status === "delivered" && (
              <>
                <Button tone="ink" size="sm" disabled={busy} onClick={() => run(() => confirmTaskCompletion(task.id), "Task confirmed complete")} data-testid="portal-confirm">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Accept & close
                </Button>
                <Button tone="outline" size="sm" disabled={busy} onClick={() => setRevising((v) => !v)} data-testid="portal-revise-toggle">
                  <RotateCcw className="h-3.5 w-3.5" /> Request changes
                </Button>
              </>
            )}
          </div>
        </div>

        {revising && (
          <div className="mt-5 rounded border border-ink-12 bg-white p-5">
            <label className="block font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60">
              What should be different?
            </label>
            <textarea
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              rows={3}
              data-testid="portal-revision-note"
              className="mt-1 w-full rounded border border-ink-20 bg-white px-3 py-2 text-[13.5px] text-ink focus:border-ink focus:outline-none"
            />
            <Button
              tone="ink"
              size="sm"
              className="mt-3"
              disabled={busy || revisionNote.trim().length < 3}
              onClick={() => run(async () => { await requestTaskRevision(task.id, revisionNote.trim()); setRevising(false); setRevisionNote(""); }, "Revision requested")}
              data-testid="portal-revise-submit"
            >
              Send revision request
            </Button>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Card title="Brief">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{task.description}</p>
              {task.attachments.length > 0 && (
                <div className="mt-4"><AttachmentList files={task.attachments} /></div>
              )}
            </Card>

            <Card title="Deliverables">
              {task.deliverables.length === 0 ? (
                <p className="text-[13px] text-ink-60">
                  Nothing delivered yet — you&rsquo;ll be notified the moment work is ready for review.
                </p>
              ) : (
                <div className="space-y-4">
                  {task.deliverables.map((d) => (
                    <div key={d.id} className="rounded border border-ink-12 p-4" data-testid={`portal-deliverable-${d.id}`}>
                      <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">
                        <Package className="h-3.5 w-3.5" /> Delivery {d.version} · {new Date(d.created_at).toLocaleDateString()}
                      </p>
                      {d.note && <p className="mt-2 whitespace-pre-wrap text-[13.5px] text-ink">{d.note}</p>}
                      <div className="mt-3"><AttachmentList files={d.files} /></div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card title="Activity">
            <TaskActivityFeed
              events={task.events}
              onPost={async (body) => {
                await addManagedTaskComment(task.id, body);
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
