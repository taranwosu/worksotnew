import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Better Auth tables (user, session, account, verification) are managed
  // automatically by the @convex-dev/better-auth component.

  // AUTH STATS - Signup tracking for Shipper analytics dashboard
  // Platform-managed table. Leave this intact.
  authStats: defineTable({
    date: v.string(),        // ISO date string "2024-01-15"
    provider: v.string(),    // "email", "google", "anonymous"
    signups: v.number(),     // Count of signups
    lastUpdated: v.number(), // Timestamp
  })
    .index("date_provider", ["date", "provider"])
    .index("date", ["date"]),

  // Application tables
  expertProfiles: defineTable({
    userId: v.string(),
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
    avatarStorageId: v.optional(v.id("_storage")),
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
  })
    .index("by_user", ["userId"])
    .index("by_category", ["category"])
    .index("by_isPublished", ["isPublished"])
    .index("by_isVerified", ["isVerified"]),

  clientRequests: defineTable({
    userId: v.string(),
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
  })
    .index("by_user", ["userId"])
    .index("by_category", ["category"])
    .index("by_status", ["status"]),

  proposals: defineTable({
    userId: v.string(),
    requestId: v.id("clientRequests"),
    expertProfileId: v.id("expertProfiles"),
    coverLetter: v.string(),
    proposedRate: v.number(),
    currency: v.string(),
    rateType: v.string(),
    estimatedDurationWeeks: v.number(),
    availability: v.string(),
    status: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_requestId", ["requestId"])
    .index("by_expertProfileId", ["expertProfileId"])
    .index("by_status", ["status"]),

  // Direct 1:1 conversations between two users.
  // userAId is always the lexicographically smaller id so a pair has one row.
  conversations: defineTable({
    userAId: v.string(),
    userBId: v.string(),
    lastMessageAt: v.number(),
    lastMessagePreview: v.string(),
    lastSenderId: v.optional(v.string()),
    lastReadAtA: v.number(),
    lastReadAtB: v.number(),
    relatedRequestId: v.optional(v.id("clientRequests")),
    relatedProposalId: v.optional(v.id("proposals")),
  })
    .index("by_pair", ["userAId", "userBId"])
    .index("by_userA", ["userAId", "lastMessageAt"])
    .index("by_userB", ["userBId", "lastMessageAt"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(),
    content: v.string(),
  })
    .index("by_conversation", ["conversationId"]),

  // Portfolio items (work samples, case studies, etc.) owned by an expert.
  portfolioItems: defineTable({
    userId: v.string(),
    expertProfileId: v.id("expertProfiles"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    size: v.optional(v.number()),
  })
    .index("by_expertProfile", ["expertProfileId"])
    .index("by_user", ["userId"]),

  // Two-way reviews. subjectType distinguishes reviews of experts vs clients.
  reviews: defineTable({
    authorId: v.string(),
    subjectUserId: v.string(),
    subjectType: v.string(), // "expert" | "client"
    expertProfileId: v.optional(v.id("expertProfiles")),
    requestId: v.optional(v.id("clientRequests")),
    proposalId: v.optional(v.id("proposals")),
    rating: v.number(), // 1..5
    title: v.string(),
    body: v.string(),
  })
    .index("by_subject", ["subjectUserId"])
    .index("by_expertProfile", ["expertProfileId"])
    .index("by_author_proposal", ["authorId", "proposalId"])
    .index("by_proposal", ["proposalId"]),

  // Milestones for an accepted proposal; the unit of project delivery.
  milestones: defineTable({
    proposalId: v.id("proposals"),
    requestId: v.id("clientRequests"),
    clientUserId: v.string(),
    expertUserId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    dueDate: v.optional(v.string()),
    status: v.string(), // "pending" | "submitted" | "approved" | "paid" | "cancelled"
    orderIndex: v.number(),
    submittedAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    deliverableNote: v.optional(v.string()),
    deliverableAttachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          fileName: v.string(),
          contentType: v.optional(v.string()),
          size: v.optional(v.number()),
        })
      )
    ),
  })
    .index("by_proposal", ["proposalId", "orderIndex"])
    .index("by_client", ["clientUserId"])
    .index("by_expert", ["expertUserId"]),

  // Contracts / SOW auto-generated from accepted proposals.
  // A contract is legally executed once both parties sign.
  contracts: defineTable({
    proposalId: v.id("proposals"),
    requestId: v.id("clientRequests"),
    clientUserId: v.string(),
    expertUserId: v.string(),
    title: v.string(),
    scope: v.string(),
    deliverables: v.string(),
    amount: v.number(),
    currency: v.string(),
    rateType: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    terms: v.string(),
    status: v.string(), // "draft" | "sent" | "signed" | "cancelled"
    clientSignature: v.optional(
      v.object({
        name: v.string(),
        signedAt: v.number(),
        ipAddress: v.optional(v.string()),
        userAgent: v.optional(v.string()),
      })
    ),
    expertSignature: v.optional(
      v.object({
        name: v.string(),
        signedAt: v.number(),
        ipAddress: v.optional(v.string()),
        userAgent: v.optional(v.string()),
      })
    ),
    sentAt: v.optional(v.number()),
    executedAt: v.optional(v.number()),
    version: v.number(),
  })
    .index("by_proposal", ["proposalId"])
    .index("by_client", ["clientUserId"])
    .index("by_expert", ["expertUserId"])
    .index("by_status", ["status"]),
});
