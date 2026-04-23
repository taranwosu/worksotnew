import { query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

// Type for Better Auth user (for TypeScript)
interface BetterAuthUser {
  _id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  createdAt: number;
  updatedAt: number;
}

// List all expertProfiles for the authenticated user
// Available as: api.queries.listExpertProfiles OR api.queries.getMyExpertProfiles
export const listExpertProfiles = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return [];

    return await ctx.db
      .query("expertProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
  },
});

// Alias for listExpertProfiles - use whichever name you prefer
export const getMyExpertProfiles = listExpertProfiles;

// Get a single expertProfile by ID (only if owned by user)
export const getExpertProfile = query({
  args: { id: v.id("expertProfiles") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return null;

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== user._id) return null;
    return item;
  },
});

// List all clientRequests for the authenticated user
// Available as: api.queries.listClientRequests OR api.queries.getMyClientRequests
export const listClientRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return [];

    return await ctx.db
      .query("clientRequests")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
  },
});

// Alias for listClientRequests - use whichever name you prefer
export const getMyClientRequests = listClientRequests;

// Get a single clientRequest by ID (only if owned by user)
export const getClientRequest = query({
  args: { id: v.id("clientRequests") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return null;

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== user._id) return null;
    return item;
  },
});

// List all proposals for the authenticated user
// Available as: api.queries.listProposals OR api.queries.getMyProposals
export const listProposals = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return [];

    return await ctx.db
      .query("proposals")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
  },
});

// Alias for listProposals - use whichever name you prefer
export const getMyProposals = listProposals;

// Get a single proposal by ID (only if owned by user)
export const getProposal = query({
  args: { id: v.id("proposals") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return null;

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== user._id) return null;
    return item;
  },
});
