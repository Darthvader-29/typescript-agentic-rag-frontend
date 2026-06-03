import { describe, it, expect } from "vitest";
import {
  SseStageSchema,
  SseStatusSchema,
  SseTokenSchema,
  SseFlatRouteSchema,
  SseRouteSchema,
  SseDoneSchema,
  SseComponentTypeSchema,
  SseComponentSchema,
  SseErrorSchema,
  FREE_TIER_EXHAUSTED,
} from "@/features/chat/api/chat.schemas";

/**
 * CONTRACT LOCK — these schemas are the frontend guardian of the backend Phase-6 SSE
 * contract (Python-Agentic-RAG-Backend/docs/09_Phase6_Agentic_Architecture.md, Appendix C).
 * If the backend ever drifts (a new status stage, a non-flat route, a component type outside
 * the catalog, a renamed error field) one of these assertions MUST fail. Loosening a schema
 * to make a drift pass is the smell this file exists to catch.
 */
describe("SSE contract — status event", () => {
  // event status -> data { "stage": "routing" | "retrieving" | "searching web" | "synthesizing" }
  const CONTRACT_STAGES = [
    "routing",
    "retrieving",
    "searching web",
    "synthesizing",
  ] as const;

  it.each(CONTRACT_STAGES)("accepts the contract stage %s", (stage) => {
    expect(SseStageSchema.parse(stage)).toBe(stage);
    expect(SseStatusSchema.parse({ stage })).toEqual({ stage });
  });

  it("keeps the literal space in 'searching web' (not 'searching_web')", () => {
    expect(SseStageSchema.safeParse("searching_web").success).toBe(false);
    expect(SseStageSchema.safeParse("searching web").success).toBe(true);
  });

  it("REJECTS a stage outside the four-stage contract (drift fails)", () => {
    for (const bad of ["done", "error", "thinking", "", "ROUTING"]) {
      expect(SseStageSchema.safeParse(bad).success).toBe(false);
      expect(SseStatusSchema.safeParse({ stage: bad }).success).toBe(false);
    }
  });
});

describe("SSE contract — token event", () => {
  it("requires a string text field", () => {
    expect(SseTokenSchema.parse({ text: "Hi" })).toEqual({ text: "Hi" });
    expect(SseTokenSchema.safeParse({ text: 42 }).success).toBe(false);
    expect(SseTokenSchema.safeParse({}).success).toBe(false);
  });
});

describe("SSE contract — done.route is a FLAT enum", () => {
  // event done -> data { ..., "route": "RAG"|"WEB"|"BOTH"|"DIRECT" } (FLAT enum)
  const FLAT_ROUTES = ["RAG", "WEB", "BOTH", "DIRECT"] as const;

  it.each(FLAT_ROUTES)("accepts the flat route %s", (route) => {
    expect(SseFlatRouteSchema.parse(route)).toBe(route);
  });

  it("REJECTS routes outside the flat enum (drift fails)", () => {
    // The frontend RouteType has extra labels (WEB+RAG, DIRECT+WEB, ERROR) but the WIRE
    // contract is exactly the four flat values — these must NOT validate as a wire route.
    for (const bad of ["WEB+RAG", "DIRECT+WEB", "DIRECT+RAG", "ERROR", "rag"]) {
      expect(SseFlatRouteSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("done requires answer and tolerates a null/omitted route", () => {
    expect(SseDoneSchema.parse({ answer: "x", route: "BOTH" })).toEqual({
      answer: "x",
      route: "BOTH",
    });
    expect(SseDoneSchema.safeParse({ answer: "x", route: null }).success).toBe(
      true
    );
    expect(SseDoneSchema.safeParse({ answer: "x" }).success).toBe(true);
    expect(SseDoneSchema.safeParse({ route: "RAG" }).success).toBe(false); // answer required
  });

  it("tolerates the legacy {destination, relevant} object defensively (union)", () => {
    // Legacy shape is NOT the contract, but the union must not crash on a stray one.
    expect(
      SseRouteSchema.safeParse({ destination: "vectorstore", relevant: true })
        .success
    ).toBe(true);
  });
});

describe("SSE contract — component envelope", () => {
  // event component -> data { "type": <catalog>, ... } (ONE whole object)
  const CATALOG = [
    "table",
    "chart",
    "citation",
    "code",
    "callout",
    "media",
  ] as const;

  it.each(CATALOG)("accepts catalog type %s", (type) => {
    expect(SseComponentTypeSchema.parse(type)).toBe(type);
    expect(SseComponentSchema.safeParse({ type }).success).toBe(true);
  });

  it("REJECTS a type outside the catalog (drift fails / dropped, never thrown)", () => {
    for (const bad of ["widget", "Table", "", "image"]) {
      expect(SseComponentTypeSchema.safeParse(bad).success).toBe(false);
      expect(SseComponentSchema.safeParse({ type: bad }).success).toBe(false);
    }
  });

  it("passes the per-type body through unchanged (.passthrough) for M10 to render", () => {
    const citation = {
      type: "citation",
      items: [{ label: "doc.pdf · p.4", source_id: "s1", snippet: "…" }],
    };
    const parsed = SseComponentSchema.parse(citation);
    expect(parsed).toEqual(citation); // extra fields preserved, not stripped
  });
});

describe("SSE contract — error event carries an optional code", () => {
  // event error -> data { "detail": "...", "code"?: "free_tier_exhausted" }
  it("parses a bare {detail}", () => {
    expect(SseErrorSchema.parse({ detail: "boom" })).toEqual({
      detail: "boom",
    });
  });

  it("parses {detail, code} and exposes the free_tier_exhausted code", () => {
    const parsed = SseErrorSchema.parse({
      detail: "no more free credits",
      code: FREE_TIER_EXHAUSTED,
    });
    expect(parsed.code).toBe("free_tier_exhausted");
  });

  it("requires detail to be a string", () => {
    expect(SseErrorSchema.safeParse({ code: "x" }).success).toBe(false);
  });
});
