import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { components } from "./_generated/api";
import { isAdmin } from "./verification";

interface BetterAuthUser {
  _id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: number | null;
  isAnonymous?: boolean | null;
  createdAt: number;
}

async function requireAdmin(ctx: any): Promise<BetterAuthUser> {
  const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
  if (!user) throw new Error("Not authenticated");
  if (!(await isAdmin(ctx, user._id))) throw new Error("Admin only");
  return user;
}

export const amIAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return false;
    return await isAdmin(ctx, user._id);
  },
});

// Platform-wide stats for the admin dashboard.
export const getPlatformStats = query({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return null;
    if (!(await isAdmin(ctx, user._id))) return null;

    const experts = await ctx.db.query("expertProfiles").collect();
    const requests = await ctx.db.query("clientRequests").collect();
    const proposals = await ctx.db.query("proposals").collect();
    const contracts = await ctx.db.query("contracts").collect();
    const reviews = await ctx.db.query("reviews").collect();
    const milestones = await ctx.db.query("milestones").collect();
    const pendingVerifications = await ctx.db
      .query("verificationRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const gmv = milestones
      .filter((m) => m.status === "paid")
      .reduce((s, m) => s + m.amount, 0);
    const escrow = contracts
      .filter((c) => c.status === "signed")
      .reduce((s, c) => s + c.amount, 0);
    const stalePaidMilestones = milestones.filter(
      (m) => m.status === "approved" && now - (m.approvedAt ?? now) > 7 * day
    );
    const stuckSubmittedMilestones = milestones.filter(
      (m) => m.status === "submitted" && now - (m.submittedAt ?? now) > 3 * day
    );
    const lowRatedReviews = reviews.filter((r) => r.rating <= 2);

    // User counts via Better Auth adapter.
    const allUsers = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      paginationOpts: { numItems: 500, cursor: null },
    });
    const users = (allUsers?.page ?? []) as BetterAuthUser[];
    const sevenDaysAgo = now - 7 * day;

    return {
      users: {
        total: users.length,
        newLast7d: users.filter((u) => (u.createdAt ?? 0) >= sevenDaysAgo)
          .length,
        banned: users.filter((u) => !!u.banned).length,
        anonymous: users.filter((u) => !!u.isAnonymous).length,
        admins: users.filter((u) => u.role === "admin" || u.role === "service-admin").length,
      },
      experts: {
        total: experts.length,
        verified: experts.filter((e) => e.isVerified).length,
        published: experts.filter((e) => e.isPublished).length,
      },
      marketplace: {
        openRequests: requests.filter((r) => r.status === "open").length,
        totalRequests: requests.length,
        proposalsSubmitted: proposals.length,
        proposalsAccepted: proposals.filter((p) => p.status === "accepted").length,
      },
      contracts: {
        total: contracts.length,
        signed: contracts.filter((c) => c.status === "signed").length,
        awaitingSignature: contracts.filter((c) => c.status === "sent").length,
        drafts: contracts.filter((c) => c.status === "draft").length,
      },
      financial: {
        gmvPaid: gmv,
        escrowInFlight: escrow,
        stuckSubmittedMilestones: stuckSubmittedMilestones.length,
        staleApprovedMilestones: stalePaidMilestones.length,
      },
      reviews: {
        total: reviews.length,
        lowRated: lowRatedReviews.length,
      },
      verification: {
        pending: pendingVerifications.length,
        identity: pendingVerifications.filter((r) => r.type === "identity").length,
        skill: pendingVerifications.filter((r) => r.type === "skill").length,
      },
    };
  },
});

// Paged user list for the admin UI — uses Better Auth adapter directly.
export const listUsersPaged = query({
  args: {
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return { users: [], isAdmin: false };
    if (!(await isAdmin(ctx, user._id))) {
      return { users: [], isAdmin: false };
    }

    const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      sortBy: { field: "createdAt", direction: "desc" },
      paginationOpts: { numItems: args.limit ?? 100, cursor: null },
    });

    const raw = ((result?.page ?? []) as BetterAuthUser[]).filter((u) => {
      if (!args.search?.trim()) return true;
      const q = args.search.trim().toLowerCase();
      return (
        u.email?.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q) ||
        u._id === args.search.trim()
      );
    });

    return {
      isAdmin: true,
      users: raw.map((u) => ({
        id: u._id,
        email: u.email,
        name: u.name ?? null,
        image: u.image ?? null,
        role: u.role ?? "user",
        banned: !!u.banned,
        banReason: u.banReason ?? null,
        isAnonymous: !!u.isAnonymous,
        createdAt: u.createdAt,
      })),
    };
  },
});

export const setUserBanned = mutation({
  args: {
    userId: v.string(),
    banned: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (admin._id === args.userId) {
      throw new Error("You cannot ban yourself");
    }
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "user",
        where: [{ field: "_id", value: args.userId }],
        update: {
          banned: args.banned,
          banReason: args.reason ?? null,
          banExpires: null,
        },
      },
    });
  },
});

export const setUserRole = mutation({
  args: {
    userId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!["user", "admin", "service-admin"].includes(args.role)) {
      throw new Error("Unknown role");
    }
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "user",
        where: [{ field: "_id", value: args.userId }],
        update: { role: args.role },
      },
    });
  },
});

// Low-rated reviews for moderation review.
export const listFlaggedReviews = query({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return [];
    if (!(await isAdmin(ctx, user._id))) return [];

    const reviews = await ctx.db
      .query("reviews")
      .filter((q) => q.lte(q.field("rating"), 2))
      .order("desc")
      .take(50);

    const pairs = await Promise.all(
      reviews.map(async (r) => {
        const author = (await ctx.runQuery(
          components.betterAuth.adapter.findOne,
          {
            model: "user",
            where: [{ field: "_id", value: r.authorId }],
          }
        )) as BetterAuthUser | null;
        const subject = (await ctx.runQuery(
          components.betterAuth.adapter.findOne,
          {
            model: "user",
            where: [{ field: "_id", value: r.subjectUserId }],
          }
        )) as BetterAuthUser | null;
        return {
          _id: r._id,
          rating: r.rating,
          title: r.title,
          body: r.body,
          createdAt: r._creationTime,
          author: author
            ? {
                id: author._id,
                name: author.name ?? author.email ?? "User",
                email: author.email ?? "",
              }
            : { id: r.authorId, name: "Unknown", email: "" },
          subject: subject
            ? {
                id: subject._id,
                name: subject.name ?? subject.email ?? "User",
                email: subject.email ?? "",
              }
            : { id: r.subjectUserId, name: "Unknown", email: "" },
        };
      })
    );
    return pairs;
  },
});

export const deleteReview = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const review = await ctx.db.get(args.reviewId);
    if (!review) return;
    await ctx.db.delete(args.reviewId);

    // Recompute expert rating if this was on an expert.
    if (review.subjectType === "expert" && review.expertProfileId) {
      const remaining = await ctx.db
        .query("reviews")
        .withIndex("by_expertProfile", (q) =>
          q.eq("expertProfileId", review.expertProfileId)
        )
        .collect();
      const count = remaining.length;
      const avg =
        count === 0
          ? 0
          : Math.round(
              (remaining.reduce((s, r) => s + r.rating, 0) / count) * 10
            ) / 10;
      const profile = await ctx.db.get(review.expertProfileId);
      if (profile) {
        await ctx.db.patch(review.expertProfileId, {
          rating: avg,
          reviewCount: count,
        });
      }
    }
  },
});

// Signals that might indicate fraud or ops issues.
export const listFraudSignals = query({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return [];
    if (!(await isAdmin(ctx, user._id))) return [];

    const signals: Array<{
      id: string;
      severity: "low" | "medium" | "high";
      title: string;
      detail: string;
    }> = [];
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Stuck milestones: submitted but not reviewed in 3+ days.
    const milestones = await ctx.db.query("milestones").collect();
    const stuckSubmitted = milestones.filter(
      (m) => m.status === "submitted" && now - (m.submittedAt ?? now) > 3 * day
    );
    if (stuckSubmitted.length > 0) {
      signals.push({
        id: "stuck-submitted",
        severity: "medium",
        title: `${stuckSubmitted.length} milestone${stuckSubmitted.length === 1 ? "" : "s"} awaiting client approval for 3+ days`,
        detail: "Clients may need a nudge or the expert may have abandoned delivery.",
      });
    }
    const staleApproved = milestones.filter(
      (m) => m.status === "approved" && now - (m.approvedAt ?? now) > 7 * day
    );
    if (staleApproved.length > 0) {
      signals.push({
        id: "stale-approved",
        severity: "high",
        title: `${staleApproved.length} approved milestone${staleApproved.length === 1 ? "" : "s"} unpaid after 7+ days`,
        detail: "Experts are owed funds. Reach out to clients to complete payment.",
      });
    }

    // Contracts sent but not signed in 14+ days.
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_status", (q) => q.eq("status", "sent"))
      .collect();
    const staleSentContracts = contracts.filter(
      (c) => now - (c.sentAt ?? now) > 14 * day
    );
    if (staleSentContracts.length > 0) {
      signals.push({
        id: "stale-sent-contracts",
        severity: "low",
        title: `${staleSentContracts.length} contract${staleSentContracts.length === 1 ? "" : "s"} sent but unsigned for 14+ days`,
        detail: "Consider auto-expiring or nudging the counterparty.",
      });
    }

    // Anonymous users who posted projects.
    const anonymousRequests = await Promise.all(
      (await ctx.db.query("clientRequests").collect()).map(async (r) => {
        const u = (await ctx.runQuery(
          components.betterAuth.adapter.findOne,
          {
            model: "user",
            where: [{ field: "_id", value: r.userId }],
          }
        )) as BetterAuthUser | null;
        return u?.isAnonymous ? r : null;
      })
    );
    const anonCount = anonymousRequests.filter(Boolean).length;
    if (anonCount > 0) {
      signals.push({
        id: "anonymous-posters",
        severity: "low",
        title: `${anonCount} project${anonCount === 1 ? "" : "s"} posted by anonymous accounts`,
        detail: "Anonymous posts are higher-risk for no-shows.",
      });
    }

    // Low-rated reviews in last 14 days.
    const recentReviews = await ctx.db.query("reviews").collect();
    const recentLowRated = recentReviews.filter(
      (r) => r.rating <= 2 && now - r._creationTime < 14 * day
    );
    if (recentLowRated.length >= 3) {
      signals.push({
        id: "low-ratings-spike",
        severity: "medium",
        title: `${recentLowRated.length} low-rated reviews in the last 14 days`,
        detail: "Could indicate a quality or fraud pattern — investigate the subjects.",
      });
    }

    return signals;
  },
});
