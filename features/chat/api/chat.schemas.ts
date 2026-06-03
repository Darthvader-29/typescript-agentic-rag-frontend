import { z } from "zod";

export const routeTypeSchema = z.enum([
  "RAG",
  "WEB",
  "DIRECT",
  "WEB+RAG",
  "DIRECT+WEB",
  "DIRECT+RAG",
  "ERROR",
]);

export const chatRequestSchema = z.object({
  message: z.string(),
  session_id: z.string(),
  web_search_allowed: z.boolean(),
  // M7: optional per-conversation BYOK provider/model. Omitted when the picker is untouched
  // ⇒ the backend uses its own default (free Gemini tier). The picker constrains `provider`
  // to the catalog; keep the request schema tolerant (string) so the contract stays loose.
  provider: z.enum(["gemini", "openai", "anthropic"]).optional(),
  model: z.string().optional(),
});

export const chatResponseSchema = z.object({
  answer: z.string(),
  route: routeTypeSchema,
  context_count: z.number().int().nonnegative(),
  session_id: z.string().optional(),
});

export const uploadResponseSchema = z
  .object({
    status: z.string().optional(),
    s3_key: z.string().optional(),
  })
  .passthrough();

export const cleanupResponseSchema = z
  .object({ status: z.string().optional() })
  .passthrough();

export type RouteType = z.infer<typeof routeTypeSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
export type UploadResponse = z.infer<typeof uploadResponseSchema>;
export type CleanupResponse = z.infer<typeof cleanupResponseSchema>;

// ---- SSE event payload schemas (authored M2; M9 locks them to the P6 contract) ----
//
// These schemas are the FRONTEND GUARDIAN of the backend Phase-6 SSE contract
// (Python-Agentic-RAG-Backend/docs/09_Phase6_Agentic_Architecture.md, Appendix C).
// They are intentionally tight: any drift in event payload shapes — an out-of-catalog
// status stage, a non-flat `done.route`, a component `type` outside the catalog — fails
// `safeParse` (and a matching contract test) rather than silently passing through.

/**
 * event: status  →  data: {"stage": "routing" | "retrieving" | "searching web" | "synthesizing"}
 *
 * The four stages are the ENTIRE contract surface (09 Appendix C). Note the literal
 * space in "searching web". A stage outside this set is contract drift and is rejected.
 */
export const SseStageSchema = z.enum([
  "routing",
  "retrieving",
  "searching web",
  "synthesizing",
]);
export type SseStage = z.infer<typeof SseStageSchema>;

export const SseStatusSchema = z.object({
  stage: SseStageSchema,
});
export type SseStatus = z.infer<typeof SseStatusSchema>;

/** event: token  →  data: {"text": "..."} */
export const SseTokenSchema = z.object({
  text: z.string(),
});
export type SseToken = z.infer<typeof SseTokenSchema>;

/**
 * done.route — the authoritative FLAT enum (09 Appendix A / contract Appendix C):
 * exactly `RAG | WEB | BOTH | DIRECT`. The frontend badge mapping is RAG→"RAG",
 * WEB→"WEB", BOTH→"WEB+RAG", DIRECT→"DIRECT" (see mapRoute in use-streaming-chat).
 */
export const SseFlatRouteSchema = z.enum(["RAG", "WEB", "BOTH", "DIRECT"]);
export type SseFlatRoute = z.infer<typeof SseFlatRouteSchema>;

/**
 * Legacy 07 `{destination, relevant}` object — superseded by the flat enum above and
 * NOT part of the live contract. Kept only as a defensive `z.union` tolerance so a stray
 * legacy frame degrades gracefully instead of crashing; droppable once the backend is
 * confirmed flat-only. Drift detection lives on the flat-enum schema, not here.
 */
export const SseLegacyRouteSchema = z.object({
  destination: z.string(),
  relevant: z.boolean().optional(),
});
export const SseRouteSchema = z.union([
  SseFlatRouteSchema,
  SseLegacyRouteSchema,
]);
export type SseRoute = z.infer<typeof SseRouteSchema>;

/** event: done  →  data: {"answer": "...", "route": "RAG"|"WEB"|"BOTH"|"DIRECT"} */
export const SseDoneSchema = z.object({
  answer: z.string(),
  // route may be null/omitted defensively; the contract always sends the flat enum.
  route: SseRouteSchema.nullable().optional(),
});
export type SseDone = z.infer<typeof SseDoneSchema>;

/**
 * The component catalog discriminant (09 Appendix C). Exactly these six types; a `type`
 * outside the catalog is dropped (never thrown) so an unknown block degrades to prose-only.
 */
export const SseComponentTypeSchema = z.enum([
  "table",
  "chart",
  "citation",
  "code",
  "callout",
  "media",
]);
export type SseComponentType = z.infer<typeof SseComponentTypeSchema>;

/**
 * event: component  →  data: {"type": <catalog>, ...} — ONE whole component object.
 *
 * M9 validates only the catalog `type` and passes the rest through (.passthrough());
 * the strict per-type discriminated union + renderers are M10. M9 STORES the block
 * (parse → onComponent → addComponent); an unknown/invalid type is dropped, never thrown.
 */
export const SseComponentSchema = z
  .object({
    type: SseComponentTypeSchema,
  })
  .passthrough();
export type SseComponent = z.infer<typeof SseComponentSchema>;

/**
 * The machine-readable error code carried by the freemium guard (docs/09 §3 / contract
 * Appendix C). The contract names `free_tier_exhausted`; the field is a tolerant string so
 * an unknown future code still parses (the UI branches only on this known value to show
 * the BYOK upsell). M7 introduces the code; M9 owns the richer streaming-error surface.
 */
export const FREE_TIER_EXHAUSTED = "free_tier_exhausted" as const;

/**
 * event: error  →  data: {"detail": "...", "code"?: "free_tier_exhausted"}
 *
 * `code` is part of the contract: it distinguishes the free-tier-exhausted BYOK-upsell
 * case from a generic error. The SAME shape is reused for the pre-stream HTTP 4xx JSON
 * body so both delivery paths funnel through one schema.
 */
export const SseErrorSchema = z.object({
  detail: z.string(),
  code: z.string().optional(),
});
export type SseError = z.infer<typeof SseErrorSchema>;
