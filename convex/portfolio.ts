import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

interface BetterAuthUser {
  _id: string;
}

export const addPortfolioItem = mutation({
  args: {
    expertProfileId: v.id("expertProfiles"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    size: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const profile = await ctx.db.get(args.expertProfileId);
    if (!profile) throw new Error("Expert profile not found");
    if (profile.userId !== user._id) throw new Error("Not authorized");

    const title = args.title.trim() || args.fileName;
    if (title.length > 120) throw new Error("Title is too long");

    return await ctx.db.insert("portfolioItems", {
      userId: user._id,
      expertProfileId: args.expertProfileId,
      storageId: args.storageId,
      fileName: args.fileName,
      contentType: args.contentType,
      title,
      description: args.description?.trim() || undefined,
      size: args.size,
    });
  },
});

export const deletePortfolioItem = mutation({
  args: { id: v.id("portfolioItems") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.id);
    if (!item) return;
    if (item.userId !== user._id) throw new Error("Not authorized");

    try {
      await ctx.storage.delete(item.storageId);
    } catch {
      // File may have already been cleaned up.
    }
    await ctx.db.delete(args.id);
  },
});

export const listMyPortfolioItems = query({
  args: { expertProfileId: v.id("expertProfiles") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return [];

    const items = await ctx.db
      .query("portfolioItems")
      .withIndex("by_expertProfile", (q) =>
        q.eq("expertProfileId", args.expertProfileId)
      )
      .collect();

    const mine = items.filter((item) => item.userId === user._id);
    return await Promise.all(
      mine.map(async (item) => ({
        ...item,
        url: await ctx.storage.getUrl(item.storageId),
      }))
    );
  },
});

export const listPublicPortfolioItems = query({
  args: { expertProfileId: v.id("expertProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.expertProfileId);
    if (!profile || !profile.isPublished) return [];

    const items = await ctx.db
      .query("portfolioItems")
      .withIndex("by_expertProfile", (q) =>
        q.eq("expertProfileId", args.expertProfileId)
      )
      .collect();

    return await Promise.all(
      items.map(async (item) => ({
        _id: item._id,
        title: item.title,
        description: item.description ?? null,
        fileName: item.fileName,
        contentType: item.contentType ?? null,
        size: item.size ?? null,
        url: await ctx.storage.getUrl(item.storageId),
      }))
    );
  },
});
