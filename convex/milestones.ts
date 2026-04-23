import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

interface BetterAuthUser {
  _id: string;
}

type MilestoneRole = "client" | "expert";

async function loadAuthorizedContext(
  ctx: any,
  userId: string,
  proposalId: any
): Promise<{
  proposal: any;
  request: any;
  role: MilestoneRole;
}> {
  const proposal = await ctx.db.get(proposalId);
  if (!proposal) throw new Error("Proposal not found");
  const request = await ctx.db.get(proposal.requestId);
  if (!request) throw new Error("Request not found");

  const isClient = request.userId === userId;
  const isExpert = proposal.userId === userId;
  if (!isClient && !isExpert) throw new Error("Not authorized");

  return {
    proposal,
    request,
    role: isClient ? "client" : "expert",
  };
}

export const createMilestone = mutation({
  args: {
    proposalId: v.id("proposals"),
    title: v.string(),
    description: v.optional(v.string()),
    amount: v.number(),
    currency: v.optional(v.string()),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const { proposal, request, role } = await loadAuthorizedContext(
      ctx,
      user._id,
      args.proposalId
    );
    if (role !== "client") {
      throw new Error("Only the client can create milestones");
    }
    if (proposal.status !== "accepted") {
      throw new Error("Proposal must be accepted before adding milestones");
    }

    const title = args.title.trim();
    if (!title) throw new Error("Milestone title is required");
    if (title.length > 120) throw new Error("Title is too long");
    if (args.amount <= 0) throw new Error("Amount must be greater than zero");

    const existing = await ctx.db
      .query("milestones")
      .withIndex("by_proposal", (q) => q.eq("proposalId", args.proposalId))
      .collect();
    const nextIndex = existing.length;

    return await ctx.db.insert("milestones", {
      proposalId: args.proposalId,
      requestId: proposal.requestId,
      clientUserId: request.userId,
      expertUserId: proposal.userId,
      title,
      description: args.description?.trim() || undefined,
      amount: args.amount,
      currency: args.currency ?? proposal.currency ?? "USD",
      dueDate: args.dueDate,
      status: "pending",
      orderIndex: nextIndex,
    });
  },
});

export const submitMilestone = mutation({
  args: {
    milestoneId: v.id("milestones"),
    deliverableNote: v.optional(v.string()),
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          fileName: v.string(),
          contentType: v.optional(v.string()),
          size: v.optional(v.number()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const milestone = await ctx.db.get(args.milestoneId);
    if (!milestone) throw new Error("Milestone not found");
    if (milestone.expertUserId !== user._id) {
      throw new Error("Only the expert can submit this milestone");
    }
    if (milestone.status !== "pending") {
      throw new Error("Milestone is not pending submission");
    }

    await ctx.db.patch(args.milestoneId, {
      status: "submitted",
      submittedAt: Date.now(),
      deliverableNote: args.deliverableNote?.trim() || undefined,
      deliverableAttachments:
        args.attachments && args.attachments.length > 0
          ? args.attachments
          : undefined,
    });
  },
});

export const approveMilestone = mutation({
  args: { milestoneId: v.id("milestones") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const milestone = await ctx.db.get(args.milestoneId);
    if (!milestone) throw new Error("Milestone not found");
    if (milestone.clientUserId !== user._id) {
      throw new Error("Only the client can approve this milestone");
    }
    if (milestone.status !== "submitted") {
      throw new Error("Milestone is not awaiting approval");
    }

    await ctx.db.patch(args.milestoneId, {
      status: "approved",
      approvedAt: Date.now(),
    });
  },
});

// Marks an approved milestone as paid. Payment capture happens off-platform
// for now; wiring this into Stripe Connect is the next phase.
export const markMilestonePaid = mutation({
  args: { milestoneId: v.id("milestones") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const milestone = await ctx.db.get(args.milestoneId);
    if (!milestone) throw new Error("Milestone not found");
    if (milestone.clientUserId !== user._id) {
      throw new Error("Only the client can mark this milestone paid");
    }
    if (milestone.status !== "approved") {
      throw new Error("Milestone must be approved before marking paid");
    }

    await ctx.db.patch(args.milestoneId, {
      status: "paid",
      paidAt: Date.now(),
    });
  },
});

export const cancelMilestone = mutation({
  args: { milestoneId: v.id("milestones") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const milestone = await ctx.db.get(args.milestoneId);
    if (!milestone) throw new Error("Milestone not found");
    if (milestone.clientUserId !== user._id) {
      throw new Error("Only the client can cancel this milestone");
    }
    if (milestone.status === "paid") {
      throw new Error("Cannot cancel a paid milestone");
    }
    await ctx.db.patch(args.milestoneId, { status: "cancelled" });
  },
});

export const listMilestones = query({
  args: { proposalId: v.id("proposals") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return [];

    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) return [];
    const request = await ctx.db.get(proposal.requestId);
    if (!request) return [];
    if (
      request.userId !== user._id &&
      proposal.userId !== user._id
    ) {
      return [];
    }

    const milestones = await ctx.db
      .query("milestones")
      .withIndex("by_proposal", (q) => q.eq("proposalId", args.proposalId))
      .collect();

    const role =
      request.userId === user._id ? ("client" as const) : ("expert" as const);

    return await Promise.all(
      milestones
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(async (m) => {
          const attachments = m.deliverableAttachments
            ? await Promise.all(
                m.deliverableAttachments.map(async (a) => ({
                  storageId: a.storageId,
                  fileName: a.fileName,
                  contentType: a.contentType ?? null,
                  size: a.size ?? null,
                  url: await ctx.storage.getUrl(a.storageId),
                }))
              )
            : [];
          return {
            ...m,
            role,
            attachments,
          };
        })
    );
  },
});

// Accepted proposals the current user is a party to — either as client or expert.
export const listMyEngagements = query({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return [];

    const myProposals = await ctx.db
      .query("proposals")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const myRequests = await ctx.db
      .query("clientRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const proposalsAsClient = (
      await Promise.all(
        myRequests.map((r) =>
          ctx.db
            .query("proposals")
            .withIndex("by_requestId", (q) => q.eq("requestId", r._id))
            .collect()
        )
      )
    ).flat();

    const candidates = [
      ...myProposals.map((p) => ({ proposal: p, role: "expert" as const })),
      ...proposalsAsClient.map((p) => ({ proposal: p, role: "client" as const })),
    ].filter((c) => c.proposal.status === "accepted");

    return await Promise.all(
      candidates.map(async (c) => {
        const request = await ctx.db.get(c.proposal.requestId);
        const milestones = await ctx.db
          .query("milestones")
          .withIndex("by_proposal", (q) => q.eq("proposalId", c.proposal._id))
          .collect();
        const paid = milestones
          .filter((m) => m.status === "paid")
          .reduce((s, m) => s + m.amount, 0);
        const total = milestones.reduce((s, m) => s + m.amount, 0);
        return {
          proposalId: c.proposal._id,
          requestId: c.proposal.requestId,
          requestTitle: request?.title ?? "Untitled project",
          role: c.role,
          currency: c.proposal.currency ?? "USD",
          proposedRate: c.proposal.proposedRate,
          rateType: c.proposal.rateType,
          milestoneCount: milestones.length,
          milestonesPaid: milestones.filter((m) => m.status === "paid").length,
          totalAmount: total,
          paidAmount: paid,
        };
      })
    );
  },
});
