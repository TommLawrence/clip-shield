/**
 * ClipShield Convex schema.
 *
 * Migrated from the in-memory / Firebase-only runtime. Only privacy-safe
 * artifacts are persisted here:
 *   - reports:      sanitized inference outputs (model text + metadata).
 *                   Raw input and rehydration mappings are NEVER stored.
 *   - glossaries:   per-session custom redaction term lists (user-supplied).
 *   - telemetry:    allow-listed, non-sensitive routing/latency metrics.
 *
 * Records are keyed by a client-generated, in-memory `sessionId` (anonymous,
 * per tab load; never persisted to browser storage) with an optional `userId`
 * slot for when Firebase anonymous auth is added.
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  reports: defineTable({
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
    createdAt: v.number(),
  }).index("by_session", ["sessionId", "createdAt"]),

  glossaries: defineTable({
    sessionId: v.string(),
    userId: v.optional(v.string()),
    terms: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_session", ["sessionId"]),

  telemetry: defineTable({
    sessionId: v.string(),
    event: v.string(),
    mode: v.optional(v.string()),
    requestedMode: v.optional(v.string()),
    inferenceSource: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    maskedCount: v.optional(v.number()),
    categoryCount: v.optional(v.number()),
    fallback: v.optional(v.boolean()),
    outcome: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    model: v.optional(v.string()),
    structured: v.optional(v.boolean()),
    sentChars: v.optional(v.number()),
    at: v.number(),
  }).index("by_session", ["sessionId", "at"]),
});