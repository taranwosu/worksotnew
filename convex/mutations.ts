import { mutation } from "./_generated/server";
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

// Create a new expertProfile
export const createExpertProfile = mutation({
  args: {
    fullName: v.string(),
    headline: v.string(),
    bio: v.string(),
    category: v.string(),
    specialties: v.array(v.string()),
    hourlyRate: v.number(),
    currency: v.string(),
    location: v.string(),
    timezone: v.string(),
    yearsExperience: v.number(),
    availability: v.string(),
    remoteOnly: v.boolean(),
    avatarUrl: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    certifications: v.array(v.string()),
    languages: v.array(v.string()),
    rating: v.number(),
    reviewCount: v.number(),
    completedProjects: v.number(),
    isVerified: v.boolean(),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    return await ctx.db.insert("expertProfiles", {
      userId: user._id,
      fullName: args.fullName,
      headline: args.headline,
      bio: args.bio,
      category: args.category,
      specialties: args.specialties,
      hourlyRate: args.hourlyRate,
      currency: args.currency,
      location: args.location,
      timezone: args.timezone,
      yearsExperience: args.yearsExperience,
      availability: args.availability,
      remoteOnly: args.remoteOnly,
      avatarUrl: args.avatarUrl,
      coverImageUrl: args.coverImageUrl,
      linkedinUrl: args.linkedinUrl,
      websiteUrl: args.websiteUrl,
      certifications: args.certifications,
      languages: args.languages,
      rating: args.rating,
      reviewCount: args.reviewCount,
      completedProjects: args.completedProjects,
      isVerified: args.isVerified,
      isPublished: args.isPublished,
    });
  },
});

// Update a expertProfile (only if owned by user)
export const updateExpertProfile = mutation({
  args: {
    id: v.id("expertProfiles"),
    fullName: v.optional(v.string()),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
    category: v.optional(v.string()),
    specialties: v.optional(v.array(v.string())),
    hourlyRate: v.optional(v.number()),
    currency: v.optional(v.string()),
    location: v.optional(v.string()),
    timezone: v.optional(v.string()),
    yearsExperience: v.optional(v.number()),
    availability: v.optional(v.string()),
    remoteOnly: v.optional(v.boolean()),
    avatarUrl: v.optional(v.optional(v.string())),
    coverImageUrl: v.optional(v.optional(v.string())),
    linkedinUrl: v.optional(v.optional(v.string())),
    websiteUrl: v.optional(v.optional(v.string())),
    certifications: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    rating: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    completedProjects: v.optional(v.number()),
    isVerified: v.optional(v.boolean()),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }

    const { id, ...updates } = args;
    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(args.id, cleanUpdates);
    return args.id;
  },
});

// Delete a expertProfile (only if owned by user)
export const deleteExpertProfile = mutation({
  args: { id: v.id("expertProfiles") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Create a new clientRequest
export const createClientRequest = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    requiredSkills: v.array(v.string()),
    budgetMin: v.number(),
    budgetMax: v.number(),
    currency: v.string(),
    budgetType: v.string(),
    engagementType: v.string(),
    durationWeeks: v.number(),
    startDate: v.optional(v.string()),
    location: v.string(),
    remoteOk: v.boolean(),
    complianceRequirements: v.array(v.string()),
    status: v.string(),
    proposalCount: v.number(),
    companyName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    return await ctx.db.insert("clientRequests", {
      userId: user._id,
      title: args.title,
      description: args.description,
      category: args.category,
      requiredSkills: args.requiredSkills,
      budgetMin: args.budgetMin,
      budgetMax: args.budgetMax,
      currency: args.currency,
      budgetType: args.budgetType,
      engagementType: args.engagementType,
      durationWeeks: args.durationWeeks,
      startDate: args.startDate,
      location: args.location,
      remoteOk: args.remoteOk,
      complianceRequirements: args.complianceRequirements,
      status: args.status,
      proposalCount: args.proposalCount,
      companyName: args.companyName,
      contactEmail: args.contactEmail,
    });
  },
});

// Update a clientRequest (only if owned by user)
export const updateClientRequest = mutation({
  args: {
    id: v.id("clientRequests"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    requiredSkills: v.optional(v.array(v.string())),
    budgetMin: v.optional(v.number()),
    budgetMax: v.optional(v.number()),
    currency: v.optional(v.string()),
    budgetType: v.optional(v.string()),
    engagementType: v.optional(v.string()),
    durationWeeks: v.optional(v.number()),
    startDate: v.optional(v.optional(v.string())),
    location: v.optional(v.string()),
    remoteOk: v.optional(v.boolean()),
    complianceRequirements: v.optional(v.array(v.string())),
    status: v.optional(v.string()),
    proposalCount: v.optional(v.number()),
    companyName: v.optional(v.optional(v.string())),
    contactEmail: v.optional(v.optional(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }

    const { id, ...updates } = args;
    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(args.id, cleanUpdates);
    return args.id;
  },
});

// Delete a clientRequest (only if owned by user)
export const deleteClientRequest = mutation({
  args: { id: v.id("clientRequests") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Create a new proposal
export const createProposal = mutation({
  args: {
    requestId: v.id("clientRequests"),
    expertProfileId: v.id("expertProfiles"),
    coverLetter: v.string(),
    proposedRate: v.number(),
    currency: v.string(),
    rateType: v.string(),
    estimatedDurationWeeks: v.number(),
    availability: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    return await ctx.db.insert("proposals", {
      userId: user._id,
      requestId: args.requestId,
      expertProfileId: args.expertProfileId,
      coverLetter: args.coverLetter,
      proposedRate: args.proposedRate,
      currency: args.currency,
      rateType: args.rateType,
      estimatedDurationWeeks: args.estimatedDurationWeeks,
      availability: args.availability,
      status: args.status,
    });
  },
});

// Update a proposal (only if owned by user)
export const updateProposal = mutation({
  args: {
    id: v.id("proposals"),
    requestId: v.optional(v.id("clientRequests")),
    expertProfileId: v.optional(v.id("expertProfiles")),
    coverLetter: v.optional(v.string()),
    proposedRate: v.optional(v.number()),
    currency: v.optional(v.string()),
    rateType: v.optional(v.string()),
    estimatedDurationWeeks: v.optional(v.number()),
    availability: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }

    const { id, ...updates } = args;
    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(args.id, cleanUpdates);
    return args.id;
  },
});

// Delete a proposal (only if owned by user)
export const deleteProposal = mutation({
  args: { id: v.id("proposals") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
