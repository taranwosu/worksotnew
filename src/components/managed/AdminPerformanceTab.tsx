import { useEffect, useState } from "react";
import { Loader2, Star, ChevronRight } from "lucide-react";
import {
  adminListPool,
  adminGetPoolMember,
  type PoolMemberRow,
  type PoolRating,
} from "@/lib/api";
import { Tag } from "@/components/primitives";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { cn } from "@/lib/utils";

export function AdminPerformanceTab() {
  const [rows, setRows] = useState<PoolMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    adminListPool()
      .then((r) => setRows([...r].sort((a, b) => b.member.performance_score - a.member.performance_score)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-cream/40" /></div>;
  }

  return (
    <div data-testid="admin-performance-tab">
      <p className="text-[13px] text-cream/70">
        Internal performance scores from completed managed tasks. Rate freelancers from the task board after completion.
      </p>
      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded border border-cream/10 p-8 text-center text-[13px] text-cream/60">No pool members yet.</div>
        ) : rows.map((r) => (
          <div key={r.member.id} className="rounded border border-cream/10 bg-ink-2">
            <button
              onClick={() => setOpenId((p) => (p === r.member.id ? null : r.member.id))}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              data-testid={`perf-member-${r.member.id}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                {r.expert?.image ? (
                  <img src={r.expert.image} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cream/10 text-[12px] font-bold text-cream">
                    {(r.user?.name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-display text-[14px] font-semibold text-cream">{r.user?.name ?? "—"}</p>
                  <p className="truncate text-[11.5px] text-cream/60">{r.expert?.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.member.performance_count > 0 ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[12px] text-cream">
                    <Star className="h-4 w-4 fill-sun text-sun" />
                    {r.member.performance_score.toFixed(1)}
                    <span className="text-cream/50">({r.member.performance_count})</span>
                  </span>
                ) : (
                  <Tag tone="outline" size="sm">unrated</Tag>
                )}
                <Tag tone={r.member.status === "active" ? "moss" : "rust"} size="sm">{r.member.status}</Tag>
                <ChevronRight className={cn("h-4 w-4 text-cream/50 transition-transform", openId === r.member.id && "rotate-90")} />
              </div>
            </button>
            {openId === r.member.id && <MemberHistory memberId={r.member.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function MemberHistory({ memberId }: { memberId: string }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminGetPoolMember>> | null>(null);

  useEffect(() => {
    adminGetPoolMember(memberId).then(setDetail).catch(() => setDetail(null));
  }, [memberId]);

  if (!detail) {
    return <div className="border-t border-cream/10 p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-cream/40" /></div>;
  }

  return (
    <div className="grid gap-4 border-t border-cream/10 p-5 md:grid-cols-2">
      <div className="rounded border border-cream/10 bg-ink p-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-cream/60">Rating history</p>
        {detail.ratings.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-cream/50">No ratings yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {detail.ratings.map((rt: PoolRating) => (
              <div key={rt.id} className="text-[12.5px]">
                <p className="flex items-center gap-1.5 text-cream/90">
                  <Star className="h-3.5 w-3.5 fill-sun text-sun" /> {rt.score}/5
                  <span className="truncate text-cream/60">· {rt.task_title ?? rt.task_id}</span>
                </p>
                {rt.notes && <p className="mt-0.5 text-[12px] text-cream/60">{rt.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded border border-cream/10 bg-ink p-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-cream/60">Assignment history</p>
        {detail.tasks.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-cream/50">No tasks assigned yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {detail.tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="min-w-0 truncate text-cream/90">{t.title}</span>
                <TaskStatusBadge status={t.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
