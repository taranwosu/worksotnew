import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

interface BetterAuthUser {
  _id: string;
}

// Returns a short-lived URL that the client uploads a file to via POST.
// The response body of that POST contains the storageId which the client
// passes back to us when saving the associated record (avatar, portfolio
// item, etc.).
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const deleteStorageFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");
    await ctx.storage.delete(args.storageId);
  },
});
