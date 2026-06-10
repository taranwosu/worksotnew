import { Tag } from "@/components/primitives";

type ToneName = "default" | "ink" | "cream" | "sun" | "moss" | "rust" | "outline";

// Covers both back-office statuses and the collapsed client-portal statuses.
const STATUS_MAP: Record<string, { label: string; tone: ToneName }> = {
  requested: { label: "Requested", tone: "sun" },
  queued: { label: "Queued", tone: "outline" },
  accepted: { label: "Queued", tone: "outline" },
  assigned: { label: "Assigned", tone: "outline" },
  in_progress: { label: "In progress", tone: "moss" },
  submitted: { label: "Needs review", tone: "sun" },
  revision_requested: { label: "Revision requested", tone: "rust" },
  delivered: { label: "Delivered", tone: "sun" },
  completed: { label: "Completed", tone: "moss" },
  on_hold: { label: "On hold", tone: "outline" },
  cancelled: { label: "Cancelled", tone: "outline" },
};

export function TaskStatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const s = STATUS_MAP[status] ?? { label: status, tone: "outline" as ToneName };
  return (
    <Tag tone={s.tone} size={size} data-testid={`task-status-${status}`}>
      {s.label}
    </Tag>
  );
}
