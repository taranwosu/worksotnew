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
}

type Role = "client" | "expert";

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

function defaultTerms(): string {
  return [
    "1. Independent Contractor Relationship. The Expert is engaged as an independent contractor. Nothing in this agreement creates an employer/employee relationship.",
    "2. Intellectual Property. Upon full payment, ownership of all deliverables transfers to the Client. The Expert retains rights to underlying methodologies, know-how, and general tools.",
    "3. Confidentiality. Both parties will treat non-public information exchanged during the engagement as confidential and will not disclose it without consent, except as required by law.",
    "4. Payment. Compensation is paid per milestone as specified in the project workspace. Milestones are billed on approval.",
    "5. Termination. Either party may terminate this engagement in writing with 7 days' notice. The Client pays for all work completed prior to termination.",
    "6. Warranties. The Expert warrants that deliverables will be original work and will not knowingly infringe any third-party rights.",
    "7. Limitation of Liability. Neither party's total liability under this agreement will exceed the total fees paid for the work in question.",
    "8. Governing Law. This agreement is governed by the laws of the Client's jurisdiction unless otherwise agreed in writing.",
  ].join("\n\n");
}

function buildScopeAndDeliverables(
  request: any,
  proposal: any
): { scope: string; deliverables: string } {
  const scope = request?.description?.trim() || proposal?.coverLetter?.trim() || "";
  const deliverablesFromSkills =
    Array.isArray(request?.requiredSkills) && request.requiredSkills.length > 0
      ? `Deliverables to cover: ${request.requiredSkills.join(", ")}.`
      : "";
  return {
    scope,
    deliverables: [
      "Deliverables, acceptance criteria, and timelines are defined per milestone in the project workspace.",
      deliverablesFromSkills,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

async function loadProposalContext(
  ctx: any,
  proposalId: Id<"proposals">,
  userId: string
) {
  const proposal = await ctx.db.get(proposalId);
  if (!proposal) throw new Error("Proposal not found");
  const request = await ctx.db.get(proposal.requestId);
  if (!request) throw new Error("Request not found");

  const isClient = request.userId === userId;
  const isExpert = proposal.userId === userId;
  if (!isClient && !isExpert) throw new Error("Not authorized for this proposal");

  return {
    proposal,
    request,
    role: (isClient ? "client" : "expert") as Role,
  };
}

export const generateFromProposal = mutation({
  args: { proposalId: v.id("proposals") },
  handler: async (ctx, args): Promise<Id<"contracts">> => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const { proposal, request } = await loadProposalContext(
      ctx,
      args.proposalId,
      user._id
    );
    if (proposal.status !== "accepted") {
      throw new Error("Contracts can only be generated for accepted proposals");
    }

    // If one already exists, return it (idempotent).
    const existing = await ctx.db
      .query("contracts")
      .withIndex("by_proposal", (q) => q.eq("proposalId", args.proposalId))
      .unique();
    if (existing) return existing._id;

    const { scope, deliverables } = buildScopeAndDeliverables(request, proposal);
    const amount =
      proposal.rateType === "fixed"
        ? proposal.proposedRate
        : proposal.proposedRate * 40 * proposal.estimatedDurationWeeks; // rough estimate

    return await ctx.db.insert("contracts", {
      proposalId: args.proposalId,
      requestId: proposal.requestId,
      clientUserId: request.userId,
      expertUserId: proposal.userId,
      title: request.title,
      scope,
      deliverables,
      amount,
      currency: proposal.currency ?? "USD",
      rateType: proposal.rateType,
      startDate: request.startDate,
      endDate: undefined,
      terms: defaultTerms(),
      status: "draft",
      version: 1,
    });
  },
});

export const updateDraft = mutation({
  args: {
    contractId: v.id("contracts"),
    title: v.optional(v.string()),
    scope: v.optional(v.string()),
    deliverables: v.optional(v.string()),
    amount: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    terms: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const contract = await ctx.db.get(args.contractId);
    if (!contract) throw new Error("Contract not found");
    if (contract.clientUserId !== user._id) {
      throw new Error("Only the client can edit this contract");
    }
    if (contract.status !== "draft") {
      throw new Error("Only draft contracts can be edited");
    }

    const { contractId, ...rest } = args;
    const updates = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined)
    );
    if (Object.keys(updates).length === 0) return contractId;
    if (typeof updates.amount === "number" && updates.amount < 0) {
      throw new Error("Amount cannot be negative");
    }
    await ctx.db.patch(contractId, updates);
    return contractId;
  },
});

export const sendContract = mutation({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const contract = await ctx.db.get(args.contractId);
    if (!contract) throw new Error("Contract not found");
    if (contract.clientUserId !== user._id) {
      throw new Error("Only the client can send the contract");
    }
    if (contract.status !== "draft") {
      throw new Error("Contract has already been sent");
    }
    if (!contract.scope.trim()) throw new Error("Scope cannot be empty");
    if (!contract.deliverables.trim()) throw new Error("Deliverables cannot be empty");
    if (contract.amount <= 0) throw new Error("Amount must be greater than zero");

    await ctx.db.patch(args.contractId, {
      status: "sent",
      sentAt: Date.now(),
    });
  },
});

export const signContract = mutation({
  args: {
    contractId: v.id("contracts"),
    signedName: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const signedName = args.signedName.trim();
    if (!signedName) throw new Error("Please type your full legal name");
    if (signedName.length > 120) throw new Error("Name is too long");

    const contract = await ctx.db.get(args.contractId);
    if (!contract) throw new Error("Contract not found");

    const isClient = contract.clientUserId === user._id;
    const isExpert = contract.expertUserId === user._id;
    if (!isClient && !isExpert) {
      throw new Error("Only the parties on this contract can sign");
    }
    if (contract.status !== "sent" && contract.status !== "draft") {
      throw new Error("This contract cannot be signed in its current status");
    }
    if (contract.status === "draft" && !isClient) {
      throw new Error("Contract has not been sent to you yet");
    }

    const now = Date.now();
    const signatureBlock = {
      name: signedName,
      signedAt: now,
      ipAddress: undefined as string | undefined,
      userAgent: args.userAgent,
    };

    const patch: any = {};
    if (isClient) {
      if (contract.clientSignature) {
        throw new Error("You have already signed this contract");
      }
      patch.clientSignature = signatureBlock;
    } else {
      if (contract.expertSignature) {
        throw new Error("You have already signed this contract");
      }
      patch.expertSignature = signatureBlock;
    }

    const clientSigned = isClient || contract.clientSignature;
    const expertSigned = isExpert || contract.expertSignature;
    if (clientSigned && expertSigned) {
      patch.status = "signed";
      patch.executedAt = now;
    }

    await ctx.db.patch(args.contractId, patch);
    return patch.status ?? contract.status;
  },
});

export const cancelContract = mutation({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const contract = await ctx.db.get(args.contractId);
    if (!contract) throw new Error("Contract not found");
    if (contract.clientUserId !== user._id) {
      throw new Error("Only the client can cancel");
    }
    if (contract.status === "signed") {
      throw new Error("Cannot cancel an executed contract");
    }
    await ctx.db.patch(args.contractId, { status: "cancelled" });
  },
});

export const getContract = query({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return null;

    const contract = await ctx.db.get(args.contractId);
    if (!contract) return null;
    if (
      contract.clientUserId !== user._id &&
      contract.expertUserId !== user._id
    ) {
      return null;
    }

    const [client, expert] = await Promise.all([
      getUserSummary(ctx, contract.clientUserId),
      getUserSummary(ctx, contract.expertUserId),
    ]);

    return {
      ...contract,
      client,
      expert,
      role: contract.clientUserId === user._id ? ("client" as Role) : ("expert" as Role),
      currentUserId: user._id,
    };
  },
});

export const listMyContracts = query({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return [];

    const asClient = await ctx.db
      .query("contracts")
      .withIndex("by_client", (q) => q.eq("clientUserId", user._id))
      .collect();
    const asExpert = await ctx.db
      .query("contracts")
      .withIndex("by_expert", (q) => q.eq("expertUserId", user._id))
      .collect();

    const all = [...asClient, ...asExpert].sort(
      (a, b) => b._creationTime - a._creationTime
    );

    const otherIds: string[] = Array.from(
      new Set(
        all.map((c) =>
          c.clientUserId === user._id ? c.expertUserId : c.clientUserId
        ) as string[]
      )
    );
    const others = await Promise.all(
      otherIds.map((id: string) => getUserSummary(ctx, id))
    );
    const otherMap = new Map(others.map((o) => [o.id, o]));

    return all.map((c) => {
      const isClient = c.clientUserId === user._id;
      const counterpartyId = isClient ? c.expertUserId : c.clientUserId;
      const mySignature = isClient ? c.clientSignature : c.expertSignature;
      const theirSignature = isClient ? c.expertSignature : c.clientSignature;
      const awaitingMe =
        c.status === "sent" && !mySignature;
      return {
        _id: c._id,
        proposalId: c.proposalId,
        title: c.title,
        amount: c.amount,
        currency: c.currency,
        status: c.status,
        role: isClient ? ("client" as Role) : ("expert" as Role),
        counterparty: otherMap.get(counterpartyId) ?? {
          id: counterpartyId,
          name: "Unknown",
          email: "",
          image: null,
        },
        awaitingMe,
        mySignedAt: mySignature?.signedAt ?? null,
        theirSignedAt: theirSignature?.signedAt ?? null,
        sentAt: c.sentAt ?? null,
        executedAt: c.executedAt ?? null,
        createdAt: c._creationTime,
      };
    });
  },
});

export const getContractByProposal = query({
  args: { proposalId: v.id("proposals") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return null;

    const contract = await ctx.db
      .query("contracts")
      .withIndex("by_proposal", (q) => q.eq("proposalId", args.proposalId))
      .unique();
    if (!contract) return null;
    if (
      contract.clientUserId !== user._id &&
      contract.expertUserId !== user._id
    ) {
      return null;
    }
    return { _id: contract._id, status: contract.status };
  },
});
