import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import {
  fetchMyManagedClient,
  listMyManagedTasks,
  createManagedTask,
  fetchMyManagedBilling,
  uploadFile,
  type ManagedClient,
  type ClientTask,
  type ManagedCharge,
} from "@/lib/api";
import { Container, Eyebrow, Button, Tag } from "@/components/primitives";
import { TaskStatusBadge } from "@/components/managed/TaskStatusBadge";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

export function ClientPortalPage() {
  usePageMeta({ title: "Client portal", path: "/portal", robots: "noindex,nofollow" });
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [client, setClient] = useState<ManagedClient | null | undefined>(undefined);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [charges, setCharges] = useState<ManagedCharge[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/signin" });
  }, [isPending, session, navigate]);

  const load = useCallback(async () => {
    const c = await fetchMyManagedClient();
    setClient(c);
    if (c) {
      const [t, ch] = await Promise.all([
        listMyManagedTasks().catch(() => [] as ClientTask[]),
        fetchMyManagedBilling().catch(() => [] as ManagedCharge[]),
      ]);
      setTasks(t);
      setCharges(ch);
    }
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  if (isPending || !session || client === undefined) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-40" /></div>;
  }

  if (client === null) {
    return (
      <div className="bg-cream pb-24 pt-16 md:pt-20">
        <Container>
          <Eyebrow accent>Managed service</Eyebrow>
          <h1 className="mt-3 font-display text-[clamp(2rem,4vw,2.75rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
            A delivery team on retainer.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-60">
            With the WorkSoy managed service you submit tasks and we handle everything else — vetted
            specialists, assignment, quality review and delivery, all managed by our back office for one
            flat rate. Your account isn&rsquo;t on a managed plan yet.
          </p>
          <div className="mt-8">
            <Link to="/contact">
              <Button tone="ink">Talk to us about a managed plan</Button>
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  const open = tasks.filter((t) => !["completed", "cancelled"].includes(t.status));
  const closed = tasks.filter((t) => ["completed", "cancelled"].includes(t.status));

  return (
    <div className="bg-cream pb-24 pt-16 md:pt-20">
      <Container>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow accent>Client portal</Eyebrow>
            <h1 className="mt-3 font-display text-[clamp(1.8rem,3.5vw,2.5rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
              {client.company_name}
            </h1>
            <p className="mt-2 text-[14px] text-ink-60">
              {client.plan_type === "monthly_retainer"
                ? `Managed plan · $${client.plan_rate.toLocaleString()}/month`
                : `Managed plan · $${client.plan_rate.toLocaleString()} per task`}
              {client.status === "paused" && " · currently paused"}
            </p>
            {client.plan_notes && <p className="mt-1 text-[12.5px] text-ink-40">{client.plan_notes}</p>}
          </div>
          <Button tone="ink" onClick={() => setCreating(true)} disabled={client.status !== "active"} data-testid="portal-new-task">
            <Plus className="h-4 w-4" /> New task request
          </Button>
        </div>

        {creating && (
          <NewTaskForm
            onClose={() => setCreating(false)}
            onCreated={() => { setCreating(false); load(); }}
          />
        )}

        <SectionHeading>{open.length} active task{open.length === 1 ? "" : "s"}</SectionHeading>
        {open.length === 0 ? (
          <div className="mt-6 rounded border border-dashed border-ink-20 bg-white px-6 py-14 text-center text-ink-60">
            Nothing in flight. Submit a task and our team will take it from there.
          </div>
        ) : (
          <TaskGrid tasks={open} />
        )}

        {closed.length > 0 && (
          <>
            <SectionHeading>History</SectionHeading>
            <TaskGrid tasks={closed} />
          </>
        )}

        {charges.length > 0 && (
          <>
            <SectionHeading>
              <span className="inline-flex items-center gap-2"><Receipt className="h-4 w-4" /> Billing</span>
            </SectionHeading>
            <div className="mt-6 overflow-hidden rounded border border-ink-12 bg-white">
              {charges.map((ch) => (
                <div key={ch.id} className="flex items-center justify-between gap-4 border-b border-ink-08 px-5 py-3 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-ink">{ch.description}</p>
                    <p className="text-[11.5px] text-ink-40">
                      {new Date(ch.created_at).toLocaleDateString()}
                      {ch.due_date ? ` · due ${new Date(ch.due_date).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[13px] text-ink">${ch.amount.toLocaleString()}</span>
                    <Tag tone={ch.status === "paid" ? "moss" : "sun"} size="sm">{ch.status}</Tag>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-ink-40">
              Invoices are settled outside the platform — this is your statement of record.
            </p>
          </>
        )}
      </Container>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-12 border-b border-ink-12 pb-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">{children}</p>
    </div>
  );
}

function TaskGrid({ tasks }: { tasks: ClientTask[] }) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {tasks.map((t) => (
        <Link
          key={t.id}
          to="/portal/tasks/$taskId"
          params={{ taskId: t.id }}
          data-testid={`portal-task-${t.id}`}
          className="group rounded border border-ink-12 bg-white p-5 transition-all hover:border-ink hover:shadow-[0_18px_40px_-22px_rgba(26,26,26,0.25)]"
        >
          <div className="flex items-center justify-between">
            <TaskStatusBadge status={t.status} />
            {t.priority === "high" && <Tag tone="rust" size="sm">high priority</Tag>}
          </div>
          <h3 className="mt-3 line-clamp-2 font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">
            {t.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-[13px] text-ink-60">{t.description}</p>
          <p className="mt-4 font-mono text-[11px] text-ink-40">
            {t.assignee_name ? `With ${t.assignee_name}` : "Awaiting assignment"}
            {t.due_date ? ` · due ${new Date(t.due_date).toLocaleDateString()}` : ""}
          </p>
        </Link>
      ))}
    </div>
  );
}

function NewTaskForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [due, setDue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const task = await createManagedTask({
        title,
        description,
        priority,
        due_date: due ? new Date(due).toISOString() : undefined,
      });
      for (const f of files) {
        try {
          await uploadFile(f, { managed_task_id: task.id });
        } catch (e) {
          toast.error(`Couldn't attach ${f.name}: ${e instanceof Error ? e.message : "upload failed"}`);
        }
      }
      toast.success("Task submitted — our team will pick it up shortly");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit task");
    } finally {
      setBusy(false);
    }
  };

  const input = "mt-1 w-full rounded border border-ink-20 bg-white px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-40 focus:border-ink focus:outline-none";
  const label = "block font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-60";

  return (
    <div className="mt-8 rounded border border-ink-12 bg-white p-6" data-testid="portal-task-form">
      <div className="flex items-center justify-between">
        <p className="font-display text-[16px] font-semibold text-ink">New task request</p>
        <button onClick={onClose} aria-label="Close" className="rounded p-1 text-ink-40 hover:bg-ink-08 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className={label}>What do you need done?</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Landing page redesign for the spring launch" data-testid="task-title" className={input} />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Details</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Goals, context, links, what success looks like… the more detail the better."
            data-testid="task-description"
            className={input}
          />
        </div>
        <div>
          <label className={label}>Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className={input}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className={label}>Needed by (optional)</label>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Attachments (optional)</label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className={cn(input, "file:mr-3 file:rounded file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-cream")}
          />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Button tone="ink" disabled={busy || title.trim().length < 3 || description.trim().length < 10} onClick={submit} data-testid="task-submit">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Submit task
        </Button>
        <Button tone="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
