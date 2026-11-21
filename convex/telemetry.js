const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

/**
 * Anonymized session telemetry — the same allow-listed, non-sensitive
 * routing/latency fields the in-memory telemetry module records.
 *
 * `payload` is spread into the row; the client only sends schema-allowed keys.
 */
import { mutation, query } from "convex/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    sessionId: v.string(),
    event: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const at = Date.now();
    await ctx.db.insert("telemetry", {
      sessionId: args.sessionId,
      event: args.event,
      ...args.payload,
      at,
    });
    return null;
  },
});

export const list = query({
  args: { sessionId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 200);
    return await ctx.db
      .query("telemetry")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);
  },
});