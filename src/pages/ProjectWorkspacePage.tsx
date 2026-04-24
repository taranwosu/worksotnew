import { Link, useParams } from "@tanstack/react-router";
// Project workspace was historically Convex-wired. MVP redirects to contract view.
export function ProjectWorkspacePage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-60">§ Project workspace</p>
      <h1 className="mt-3 font-display text-3xl font-medium text-ink">Open in contract view</h1>
      <p className="mt-3 text-[14px] text-ink-60">
        The workspace has moved into the contract page — milestones, payments, and messaging all live there.
      </p>
      <Link
        to="/contracts/$contractId"
        params={{ contractId: projectId }}
        className="mt-6 inline-flex items-center gap-1.5 rounded bg-ink px-4 py-2 text-[13px] font-semibold text-cream"
      >
        Open contract {projectId}
      </Link>
    </div>
  );
}
