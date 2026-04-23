import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { components } from "./_generated/api";

interface BetterAuthUser {
  _id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

async function getUserSummary(ctx: any, userId: string) {
  const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", value: userId }],
  })) as BetterAuthUser | null;
  if (!user) {
    return { id: userId, name: "Unknown user", image: null };
  }
  return {
    id: user._id,
    name: user.name?.trim() || user.email?.split("@")[0] || "User",
    image: user.image ?? null,
  };
}

export const createReview = mutation({
  args: {
    proposalId: v.id("proposals"),
    rating: v.number(),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title) throw new Error("Review title is required");
    if (!body) throw new Error("Review body is required");
    if (title.length > 120) throw new Error("Title is too long");
    if (body.length > 2000) throw new Error("Review body is too long");

    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.status !== "accepted") {
      throw new Error("Reviews can only be left on accepted engagements");
    }

    const request = await ctx.db.get(proposal.requestId);
    if (!request) throw new Error("Request not found");

    const clientUserId = request.userId;
    const expertUserId = proposal.userId;
    const isClient = user._id === clientUserId;
    const isExpert = user._id === expertUserId;
    if (!isClient && !isExpert) {
      throw new Error("Only the client or expert on this engagement can review");
    }
    const subjectUserId = isClient ? expertUserId : clientUserId;
    const subjectType = isClient ? "expert" : "client";

    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_author_proposal", (q) =>
        q.eq("authorId", user._id).eq("proposalId", args.proposalId)
      )
      .unique();
    if (existing) {
      throw new Error("You have already reviewed this engagement");
    }

    const reviewId = await ctx.db.insert("reviews", {
      authorId: user._id,
      subjectUserId,
      subjectType,
      expertProfileId: isClient ? proposal.expertProfileId : undefined,
      requestId: proposal.requestId,
      proposalId: args.proposalId,
      rating: args.rating,
      title,
      body,
    });

    // When the subject is the expert, recompute their aggregate rating.
    if (subjectType === "expert") {
      const allReviews = await ctx.db
        .query("reviews")
        .withIndex("by_expertProfile", (q) =>
          q.eq("expertProfileId", proposal.expertProfileId)
        )
        .collect();

      const count = allReviews.length;
      const avg =
        count === 0
          ? 0
          : Math.round(
              (allReviews.reduce((s, r) => s + r.rating, 0) / count) * 10
            ) / 10;

      const profile = await ctx.db.get(proposal.expertProfileId);
      if (profile) {
        await ctx.db.patch(proposal.expertProfileId, {
          rating: avg,
          reviewCount: count,
        });
      }
    }

    return reviewId;
  },
});

export const listReviewsForUser = query({
  args: { subjectUserId: v.string() },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_subject", (q) => q.eq("subjectUserId", args.subjectUserId))
      .order("desc")
      .collect();

    const authorIds: string[] = Array.from(
      new Set(reviews.map((r) => r.authorId as string))
    );
    const authors = await Promise.all(
      authorIds.map((id: string) => getUserSummary(ctx, id))
    );
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    return reviews.map((r) => ({
      _id: r._id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      subjectType: r.subjectType,
      createdAt: r._creationTime,
      author: authorMap.get(r.authorId) ?? {
        id: r.authorId,
        name: "Unknown",
        image: null,
      },
    }));
  },
});

export const listReviewsForExpertProfile = query({
  args: { expertProfileId: v.id("expertProfiles") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_expertProfile", (q) =>
        q.eq("expertProfileId", args.expertProfileId)
      )
      .order("desc")
      .collect();

    const authorIds: string[] = Array.from(
      new Set(reviews.map((r) => r.authorId as string))
    );
    const authors = await Promise.all(
      authorIds.map((id: string) => getUserSummary(ctx, id))
    );
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    return reviews.map((r) => ({
      _id: r._id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      createdAt: r._creationTime,
      author: authorMap.get(r.authorId) ?? {
        id: r.authorId,
        name: "Unknown",
        image: null,
      },
    }));
  },
});

// Proposals where the current user can leave a review but has not yet.
export const listReviewableProposals = query({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return [];

    // Proposals where current user is the expert (owns the proposal).
    const myProposals = await ctx.db
      .query("proposals")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Requests where current user is the client; the accepted proposal is
    // what they can review the expert on.
    const myRequests = await ctx.db
      .query("clientRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const myRequestIds = new Set(myRequests.map((r) => r._id));

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
      ...myProposals.map((p) => ({
        proposal: p,
        role: "expert" as const,
      })),
      ...proposalsAsClient.map((p) => ({
        proposal: p,
        role: "client" as const,
      })),
    ].filter(
      (c) =>
        c.proposal.status === "accepted" &&
        // Avoid duplicates when the user is both sides (shouldn't happen but defensive).
        (c.role === "expert"
          ? c.proposal.userId === user._id
          : myRequestIds.has(c.proposal.requestId))
    );

    // Remove ones the user has already reviewed.
    const results: Array<{
      proposalId: any;
      requestId: any;
      role: "client" | "expert";
      subjectUserId: string;
      requestTitle: string;
    }> = [];
    for (const c of candidates) {
      const existing = await ctx.db
        .query("reviews")
        .withIndex("by_author_proposal", (q) =>
          q.eq("authorId", user._id).eq("proposalId", c.proposal._id)
        )
        .unique();
      if (existing) continue;
      const request = await ctx.db.get(c.proposal.requestId);
      if (!request) continue;
      const subjectUserId =
        c.role === "expert" ? request.userId : c.proposal.userId;
      results.push({
        proposalId: c.proposal._id,
        requestId: c.proposal.requestId,
        role: c.role,
        subjectUserId,
        requestTitle: request.title,
      });
    }

    return results;
  },
});
