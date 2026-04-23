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

function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function getUserSummary(
  ctx: any,
  userId: string
): Promise<{ id: string; name: string; email: string; image: string | null }> {
  const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", value: userId }],
  })) as BetterAuthUser | null;

  if (!user) {
    return { id: userId, name: "Unknown user", email: "", image: null };
  }

  const name = user.name?.trim() || user.email?.split("@")[0] || "User";
  return {
    id: user._id,
    name,
    email: user.email ?? "",
    image: user.image ?? null,
  };
}

export const getOrCreateConversation = mutation({
  args: {
    otherUserId: v.string(),
    relatedRequestId: v.optional(v.id("clientRequests")),
    relatedProposalId: v.optional(v.id("proposals")),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");
    if (user._id === args.otherUserId) {
      throw new Error("Cannot start a conversation with yourself");
    }

    const [userAId, userBId] = orderPair(user._id, args.otherUserId);

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_pair", (q) =>
        q.eq("userAId", userAId).eq("userBId", userBId)
      )
      .unique();

    if (existing) {
      if (
        (args.relatedRequestId && !existing.relatedRequestId) ||
        (args.relatedProposalId && !existing.relatedProposalId)
      ) {
        await ctx.db.patch(existing._id, {
          relatedRequestId: args.relatedRequestId ?? existing.relatedRequestId,
          relatedProposalId:
            args.relatedProposalId ?? existing.relatedProposalId,
        });
      }
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("conversations", {
      userAId,
      userBId,
      lastMessageAt: now,
      lastMessagePreview: "",
      lastReadAtA: userAId === user._id ? now : 0,
      lastReadAtB: userBId === user._id ? now : 0,
      relatedRequestId: args.relatedRequestId,
      relatedProposalId: args.relatedProposalId,
    });
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const trimmed = args.content.trim();
    if (!trimmed) throw new Error("Message cannot be empty");
    if (trimmed.length > 5000) throw new Error("Message is too long");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (
      conversation.userAId !== user._id &&
      conversation.userBId !== user._id
    ) {
      throw new Error("Not a participant in this conversation");
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: user._id,
      content: trimmed,
    });

    const now = Date.now();
    const preview = trimmed.length > 120 ? trimmed.slice(0, 117) + "..." : trimmed;
    const isA = conversation.userAId === user._id;
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      lastMessagePreview: preview,
      lastSenderId: user._id,
      lastReadAtA: isA ? now : conversation.lastReadAtA,
      lastReadAtB: isA ? conversation.lastReadAtB : now,
    });

    return messageId;
  },
});

export const markConversationRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;
    const now = Date.now();
    if (conversation.userAId === user._id) {
      await ctx.db.patch(args.conversationId, { lastReadAtA: now });
    } else if (conversation.userBId === user._id) {
      await ctx.db.patch(args.conversationId, { lastReadAtB: now });
    }
  },
});

export const listMyConversations = query({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return [];

    const asA = await ctx.db
      .query("conversations")
      .withIndex("by_userA", (q) => q.eq("userAId", user._id))
      .collect();
    const asB = await ctx.db
      .query("conversations")
      .withIndex("by_userB", (q) => q.eq("userBId", user._id))
      .collect();

    const all = [...asA, ...asB].sort(
      (a, b) => b.lastMessageAt - a.lastMessageAt
    );

    const otherIds = Array.from(
      new Set(
        all.map((c) => (c.userAId === user._id ? c.userBId : c.userAId))
      )
    );
    const others = await Promise.all(
      otherIds.map((id) => getUserSummary(ctx, id))
    );
    const otherMap = new Map(others.map((u) => [u.id, u]));

    return all.map((c) => {
      const otherUserId = c.userAId === user._id ? c.userBId : c.userAId;
      const myLastRead =
        c.userAId === user._id ? c.lastReadAtA : c.lastReadAtB;
      const hasUnread =
        Boolean(c.lastSenderId) &&
        c.lastSenderId !== user._id &&
        c.lastMessageAt > myLastRead;
      return {
        _id: c._id,
        otherUser: otherMap.get(otherUserId) ?? {
          id: otherUserId,
          name: "Unknown user",
          email: "",
          image: null,
        },
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: c.lastMessagePreview,
        lastSenderId: c.lastSenderId ?? null,
        hasUnread,
        relatedRequestId: c.relatedRequestId ?? null,
        relatedProposalId: c.relatedProposalId ?? null,
      };
    });
  },
});

export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return null;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;
    if (
      conversation.userAId !== user._id &&
      conversation.userBId !== user._id
    ) {
      return null;
    }

    const otherUserId =
      conversation.userAId === user._id
        ? conversation.userBId
        : conversation.userAId;
    const otherUser = await getUserSummary(ctx, otherUserId);
    const myLastRead =
      conversation.userAId === user._id
        ? conversation.lastReadAtA
        : conversation.lastReadAtB;

    return {
      _id: conversation._id,
      otherUser,
      myLastRead,
      relatedRequestId: conversation.relatedRequestId ?? null,
      relatedProposalId: conversation.relatedProposalId ?? null,
      currentUserId: user._id,
    };
  },
});

export const listMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return [];

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return [];
    if (
      conversation.userAId !== user._id &&
      conversation.userBId !== user._id
    ) {
      return [];
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    return messages.map((m) => ({
      _id: m._id,
      senderId: m.senderId,
      content: m.content,
      createdAt: m._creationTime,
      isMine: m.senderId === user._id,
    }));
  },
});

export const getUnreadSummary = query({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) return { unreadConversations: 0 };

    const asA = await ctx.db
      .query("conversations")
      .withIndex("by_userA", (q) => q.eq("userAId", user._id))
      .collect();
    const asB = await ctx.db
      .query("conversations")
      .withIndex("by_userB", (q) => q.eq("userBId", user._id))
      .collect();

    let unread = 0;
    for (const c of [...asA, ...asB]) {
      const myLastRead =
        c.userAId === user._id ? c.lastReadAtA : c.lastReadAtB;
      if (
        c.lastSenderId &&
        c.lastSenderId !== user._id &&
        c.lastMessageAt > myLastRead
      ) {
        unread += 1;
      }
    }
    return { unreadConversations: unread };
  },
});

// Helper: start a conversation with the counterparty of a proposal.
// Experts use this to message the client who posted the request;
// clients use it to message the expert who submitted the proposal.
export const startConversationFromProposal = mutation({
  args: { proposalId: v.id("proposals") },
  handler: async (ctx, args): Promise<Id<"conversations">> => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) throw new Error("Proposal not found");

    const request = await ctx.db.get(proposal.requestId);
    if (!request) throw new Error("Request not found");

    const clientUserId = request.userId;
    const expertUserId = proposal.userId;
    const otherUserId = user._id === clientUserId ? expertUserId : clientUserId;
    if (user._id !== clientUserId && user._id !== expertUserId) {
      throw new Error("Not authorized to message this proposal");
    }

    const [userAId, userBId] = orderPair(user._id, otherUserId);
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_pair", (q) =>
        q.eq("userAId", userAId).eq("userBId", userBId)
      )
      .unique();
    if (existing) {
      if (!existing.relatedProposalId || !existing.relatedRequestId) {
        await ctx.db.patch(existing._id, {
          relatedProposalId: existing.relatedProposalId ?? args.proposalId,
          relatedRequestId: existing.relatedRequestId ?? proposal.requestId,
        });
      }
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("conversations", {
      userAId,
      userBId,
      lastMessageAt: now,
      lastMessagePreview: "",
      lastReadAtA: userAId === user._id ? now : 0,
      lastReadAtB: userBId === user._id ? now : 0,
      relatedProposalId: args.proposalId,
      relatedRequestId: proposal.requestId,
    });
  },
});
