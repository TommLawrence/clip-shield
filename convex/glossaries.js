const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

/**
 * Per-session custom redaction glossaries.
 *
 * Upsert by sessionId: each session has one glossary row holding the user's
 * custom term list. Terms are user-supplied redaction rules, not detected PII.
 */
import { mutation, query } from "convex/server";
import { v } from "convex/values";

export const sync = mutation({
  args: {
    sessionId: v.string(),
    userId: v.optional(v.string()),
    terms: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("glossaries")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        terms: args.terms,
        userId: args.userId,
        updatedAt,
      });
      return existing._id;
    }
    return await ctx.db.insert("glossaries", {
      sessionId: args.sessionId,
      userId: args.userId,
      terms: args.terms,
      updatedAt,
    });
  },
});

export const get = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("glossaries")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();
  },
});