const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

/**
 * Saved analysis reports — sanitized inference outputs only.
 *
 * The client sends the model's response text and routing metadata. Raw input,
 * the sanitized text that was sent, and the rehydration mapping never reach
 * this module by design.
 */
import { mutation, query } from "convex/server";
import { v } from "convex/values";

export const save = mutation({
  args: {
    sessionId: v.string(),
    userId: v.optional(v.string()),
    modeKey: v.string(),
    model: v.string(),
    inferenceSource: v.optional(v.string()),
    latencyMs: v.number(),
    maskedCount: v.number(),
    categoryCount: v.number(),
    sentChars: v.number(),
    structured: v.boolean(),
    text: v.string(),
    json: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    const id = await ctx.db.insert("reports", { ...args, createdAt });
    return id;
  },
});

export const list = query({
  args: { sessionId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 200);
    return await ctx.db
      .query("reports")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);
  },
});