import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

interface BetterAuthUser {
  _id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role?: string | null;
}

async function getAuthUser(ctx: any): Promise<BetterAuthUser | null> {
  return (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
}

export async function isAdmin(ctx: any, userId: string): Promise<boolean> {
  const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", value: userId }],
  })) as BetterAuthUser | null;
  return user?.role === "admin" || user?.role === "service-admin";
}

async function getUserSummary(ctx: any, userId: string) {
  const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", value: userId }],
  })) as BetterAuthUser | null;
  if (!user) {
    return { id: userId, name: "Unknown user", email: "", image: null };
  }
  return {
    id: user._id,
    name: user.name?.trim() || user.email?.split("@")[0] || "User",
    email: user.email ?? "",
    image: user.image ?? null,
  };
}

const MAX_DOCS = 10;

export const submitVerificationRequest = mutation({
  args: {
    type: v.string(), // "identity" | "skill"
    skillName: v.optional(v.string()),
    note: v.optional(v.string()),
    documents: v.array(
      v.object({
        storageId: v.id("_storage"),
        fileName: v.string(),
        label: v.optional(v.string()),
        contentType: v.optional(v.string()),
        size: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    if (args.type !== "identity" && args.type !== "skill") {
      throw new Error("Invalid verification type");
    }
    if (args.type === "skill") {
      const name = args.skillName?.trim();
      if (!name) throw new Error("Skill name is required");
      if (name.length > 80) throw new Error("Skill name is too long");
    }
    if (args.documents.length === 0) {
      throw new Error("At least one supporting document is required");
    }
    if (args.documents.length > MAX_DOCS) {
      throw new Error("Too many documents");
    }

    const expertProfile = await ctx.db
      .query("expertProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Reject duplicate in-flight requests of the same kind.
    const existing = await ctx.db
      .query("verificationRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const hasPending = existing.some(
      (r) =>
        r.status === "pending" &&
        r.type === args.type &&
        (args.type !== "skill" ||
          r.skillName?.toLowerCase() === args.skillName?.trim().toLowerCase())
    );
    if (hasPending) {
      throw new Error(
        args.type === "identity"
          ? "You already have an identity verification in review"
          : "You already have a pending request for this skill"
      );
    }

    if (args.type === "skill" && expertProfile) {
      const already = await ctx.db
        .query("skillBadges")
        .withIndex("by_name", (q) =>
          q
            .eq("expertProfileId", expertProfile._id)
            .eq("name", args.skillName!.trim())
        )
        .first();
      if (already) throw new Error("You already hold this skill badge");
    }

    return await ctx.db.insert("verificationRequests", {
      userId: user._id,
      expertProfileId: expertProfile?._id,
      type: args.type,
      status: "pending",
      skillName: args.skillName?.trim(),
      note: args.note?.trim() || undefined,
      documents: args.documents,
      submittedAt: Date.now(),
    });
  },
});

export const cancelMyVerificationRequest = mutation({
  args: { requestId: v.id("verificationRequests") },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const req = await ctx.db.get(args.requestId);
    if (!req) return;
    if (req.userId !== user._id) throw new Error("Not authorized");
    if (req.status !== "pending") {
      throw new Error("Only pending requests can be cancelled");
    }
    // Best-effort: remove uploaded documents.
    for (const doc of req.documents) {
      try {
        await ctx.storage.delete(doc.storageId);
      } catch {}
    }
    await ctx.db.delete(args.requestId);
  },
});

export const listMyVerificationRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    if (!user) return [];

    const requests = await ctx.db
      .query("verificationRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return await Promise.all(
      requests.map(async (r) => ({
        _id: r._id,
        type: r.type,
        status: r.status,
        skillName: r.skillName ?? null,
        note: r.note ?? null,
        reviewNote: r.reviewNote ?? null,
        submittedAt: r.submittedAt,
        reviewedAt: r.reviewedAt ?? null,
        documents: await Promise.all(
          r.documents.map(async (d) => ({
            storageId: d.storageId,
            fileName: d.fileName,
            label: d.label ?? null,
            contentType: d.contentType ?? null,
            size: d.size ?? null,
            url: await ctx.storage.getUrl(d.storageId),
          }))
        ),
      }))
    );
  },
});

export const listMyBadges = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    if (!user) return [];
    const badges = await ctx.db
      .query("skillBadges")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return badges.map((b) => ({
      _id: b._id,
      name: b.name,
      issuedAt: b._creationTime,
      evidenceUrl: b.evidenceUrl ?? null,
      note: b.note ?? null,
    }));
  },
});

export const listBadgesForExpertProfile = query({
  args: { expertProfileId: v.id("expertProfiles") },
  handler: async (ctx, args) => {
    const badges = await ctx.db
      .query("skillBadges")
      .withIndex("by_expertProfile", (q) =>
        q.eq("expertProfileId", args.expertProfileId)
      )
      .collect();
    return badges.map((b) => ({
      _id: b._id,
      name: b.name,
      issuedAt: b._creationTime,
    }));
  },
});

// --- Admin-only ---

export const listPendingVerifications = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    if (!user) return [];
    if (!(await isAdmin(ctx, user._id))) return [];

    const pending = await ctx.db
      .query("verificationRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .collect();

    return await Promise.all(
      pending.map(async (r) => ({
        _id: r._id,
        type: r.type,
        status: r.status,
        skillName: r.skillName ?? null,
        note: r.note ?? null,
        submittedAt: r.submittedAt,
        submitter: await getUserSummary(ctx, r.userId),
        documents: await Promise.all(
          r.documents.map(async (d) => ({
            storageId: d.storageId,
            fileName: d.fileName,
            label: d.label ?? null,
            contentType: d.contentType ?? null,
            size: d.size ?? null,
            url: await ctx.storage.getUrl(d.storageId),
          }))
        ),
      }))
    );
  },
});

export const listAllVerifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) return [];
    if (!(await isAdmin(ctx, user._id))) return [];
    const limit = args.limit ?? 100;

    const all = await ctx.db.query("verificationRequests").order("desc").take(limit);
    return await Promise.all(
      all.map(async (r) => ({
        _id: r._id,
        type: r.type,
        status: r.status,
        skillName: r.skillName ?? null,
        submittedAt: r.submittedAt,
        reviewedAt: r.reviewedAt ?? null,
        submitter: await getUserSummary(ctx, r.userId),
      }))
    );
  },
});

export const approveVerification = mutation({
  args: {
    requestId: v.id("verificationRequests"),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthUser(ctx);
    if (!admin) throw new Error("Not authenticated");
    if (!(await isAdmin(ctx, admin._id))) throw new Error("Admin only");

    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found");
    if (req.status !== "pending") {
      throw new Error("Request is not pending");
    }

    await ctx.db.patch(args.requestId, {
      status: "approved",
      reviewedAt: Date.now(),
      reviewedBy: admin._id,
      reviewNote: args.reviewNote?.trim() || undefined,
    });

    if (req.type === "identity" && req.expertProfileId) {
      await ctx.db.patch(req.expertProfileId, { isVerified: true });
    }

    if (req.type === "skill" && req.expertProfileId && req.skillName) {
      const existing = await ctx.db
        .query("skillBadges")
        .withIndex("by_name", (q) =>
          q.eq("expertProfileId", req.expertProfileId!).eq("name", req.skillName!)
        )
        .first();
      if (!existing) {
        await ctx.db.insert("skillBadges", {
          expertProfileId: req.expertProfileId,
          userId: req.userId,
          name: req.skillName,
          issuedBy: admin._id,
          note: args.reviewNote?.trim() || undefined,
        });
      }
    }
  },
});

export const rejectVerification = mutation({
  args: {
    requestId: v.id("verificationRequests"),
    reviewNote: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getAuthUser(ctx);
    if (!admin) throw new Error("Not authenticated");
    if (!(await isAdmin(ctx, admin._id))) throw new Error("Admin only");

    const note = args.reviewNote.trim();
    if (!note) throw new Error("A rejection note is required");

    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found");
    if (req.status !== "pending") {
      throw new Error("Request is not pending");
    }

    await ctx.db.patch(args.requestId, {
      status: "rejected",
      reviewedAt: Date.now(),
      reviewedBy: admin._id,
      reviewNote: note,
    });
  },
});

export const revokeBadge = mutation({
  args: { badgeId: v.id("skillBadges") },
  handler: async (ctx, args) => {
    const admin = await getAuthUser(ctx);
    if (!admin) throw new Error("Not authenticated");
    if (!(await isAdmin(ctx, admin._id))) throw new Error("Admin only");
    await ctx.db.delete(args.badgeId);
  },
});

export const revokeIdentityVerification = mutation({
  args: { expertProfileId: v.id("expertProfiles") },
  handler: async (ctx, args) => {
    const admin = await getAuthUser(ctx);
    if (!admin) throw new Error("Not authenticated");
    if (!(await isAdmin(ctx, admin._id))) throw new Error("Admin only");
    const profile = await ctx.db.get(args.expertProfileId);
    if (!profile) return;
    await ctx.db.patch(args.expertProfileId, { isVerified: false });
  },
});
