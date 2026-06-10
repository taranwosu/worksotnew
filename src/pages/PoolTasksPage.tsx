import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import {
  fetchMyPoolMembership,
  listPoolTasks,
  type PoolMember,
  type ManagedTask,
} from "@/lib/api";
import { Container, Eyebrow, Tag } from "@/components/primitives";
import { TaskStatusBadge } from "@/components/managed/TaskStatusBadge";
import { usePageMeta } from "@/lib/seo";

const ACTIVE_FIRST: Record<string, number> = {
  revision_requested: 0,
  assigned: 1,
  in_progress: 2,
  submitted: 3,
  delivered: 4,
  on_hold: 5,
  completed: 6,
  cancelled: 7,
};

export function PoolTasksPage() {
  usePageMeta({ title: "My pool tasks", path: "/pool/tasks", robots: "noindex,nofollow" });
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [membership, setMembership] = useState<PoolMember | null | undefined>(undefined);
  const [tasks, setTasks] = useState<ManagedTask[]>([]);

  useEffect(() => {
    if (!isPending && !session) navigate({ to: "/signin" });
  }, [isPending, session, navigate]);

  useEffect(() => {
    if (!session) return;
    fetchMyPoolMembership().then((m) => {
      setMembership(m);
      if (m) listPoolTasks().then(setTasks).catch(() => setTasks([]));
    });
  }, [session]);

  if (isPending || !session || membership === undefined) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-40" /></div>;
  }

  if (membership === null) {
    return (
      <div className="bg-cream pb-24 pt-16 md:pt-20">
        <Container>
          <Eyebrow accent>Managed pool</Eyebrow>
          <h1 className="mt-3 font-display text-[clamp(2rem,4vw,2.75rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
            This workspace is for pool contractors.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-60">
            WorkSoy invites vetted experts into the managed pool to deliver client tasks on contract.
            Get verified and our team may reach out.
          </p>
        </Container>
      </div>
    );
  }

  const sorted = [...tasks].sort(
    (a, b) => (ACTIVE_FIRST[a.status] ?? 9) - (ACTIVE_FIRST[b.status] ?? 9),
  );
  const needsAction = tasks.filter((t) => ["assigned", "revision_requested"].includes(t.status)).length;

  return (
    <div className="bg-cream pb-24 pt-16 md:pt-20">
      <Container>
        <Eyebrow accent>Managed pool</Eyebrow>
        <h1 className="mt-3 font-display text-[clamp(1.8rem,3.5vw,2.5rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
          Your assigned tasks.
        </h1>
        <p className="mt-2 text-[14px] text-ink-60">
          Contracted at ${membership.cost_rate}/{membership.cost_rate_type === "hourly" ? "hr" : "task"} ·
          deliverables go to the WorkSoy team for review before they reach the client.
          {needsAction > 0 && ` ${needsAction} task${needsAction === 1 ? " needs" : "s need"} your attention.`}
        </p>

        {sorted.length === 0 ? (
          <div className="mt-10 rounded border border-dashed border-ink-20 bg-white px-6 py-16 text-center text-ink-60">
            No assignments yet — you&rsquo;ll get a notification when a task lands.
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {sorted.map((t) => (
              <Link
                key={t.id}
                to="/pool/tasks/$taskId"
                params={{ taskId: t.id }}
                data-testid={`pool-task-${t.id}`}
                className="flex items-center justify-between gap-4 rounded border border-ink-12 bg-white px-5 py-4 transition-all hover:border-ink"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-[15px] font-semibold text-ink">{t.title}</p>
                  <p className="truncate text-[12px] text-ink-60">
                    {t.company_name ?? "Client"}
                    {t.due_date ? ` · due ${new Date(t.due_date).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {t.priority === "high" && <Tag tone="rust" size="sm">high</Tag>}
                  <TaskStatusBadge status={t.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
