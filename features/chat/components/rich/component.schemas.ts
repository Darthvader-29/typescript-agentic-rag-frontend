// features/chat/components/rich/component.schemas.ts
//
// STRICT per-type schemas for the P6 component catalog — the RENDER gate (M10).
//
// SYNC: source of truth is the backend contract
//   Python-Agentic-RAG-Backend/docs/09_Phase6_Agentic_Architecture.md §5 + Appendix C.
//     table / chart / citation / callout  -> verbatim from Appendix C
//     code  / media                       -> shape ASSUMED (09 §9 lists the exact pydantic
//                                            schemas as an open build-time detail); see M10 §2.4.
//
// The loose SseComponentSchema (M2, chat.schemas.ts) stays permissive at the wire/store
// boundary so a forward-compatible block still reaches the store. Here we re-validate STRICTLY
// and DROP anything that doesn't match, mirroring the backend's "invalid block dropped, never a
// 500" rule (09 §5 / M10 §2.5). This is the only place the renderer trusts a spec's shape.
import { z } from "zod";

/** SYNC 09 Appendix C — table: {"type":"table","columns":[...],"rows":[[...],[...]]}. */
export const tableSchema = z.object({
  type: z.literal("table"),
  columns: z.array(z.string()),
  // Cells are scalars; coerce-tolerant (string|number|boolean|null) and rendered as text only.
  rows: z.array(
    z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
  ),
  caption: z.string().optional(),
});

/** SYNC 09 Appendix C — chart: {"type":"chart","chart":"bar","x":[...],"series":[{"name","y":[...]}]}. */
export const chartSeriesSchema = z.object({
  name: z.string(),
  y: z.array(z.number()),
});
export const chartSchema = z.object({
  type: z.literal("chart"),
  // Appendix C shows "bar"; line/area are reasonable supersets the renderer also handles.
  chart: z.enum(["bar", "line", "pie", "area"]).default("bar"),
  x: z.array(z.union([z.string(), z.number()])),
  series: z.array(chartSeriesSchema).min(1),
  title: z.string().optional(),
});

/** SYNC 09 Appendix C — citation: {"type":"citation","items":[{"label","source_id","snippet"}]}. PROVENANCE. */
export const citationItemSchema = z.object({
  label: z.string(),
  source_id: z.string().optional(),
  snippet: z.string().optional(),
  // Web sources may carry a URL; retrieved chunks carry only a source_id.
  url: z.string().url().optional(),
});
export const citationSchema = z.object({
  type: z.literal("citation"),
  items: z.array(citationItemSchema).min(1),
});

/** SYNC 09 Appendix C — callout: {"type":"callout","level":"info"|"warning"|"tip","text":...}. */
export const calloutSchema = z.object({
  type: z.literal("callout"),
  level: z.enum(["info", "warning", "tip"]).default("info"),
  text: z.string(),
  title: z.string().optional(),
});

/** SYNC ASSUMED (09 §9 open; M10 §2.4) — code: {"type":"code","language":...,"code":...}. */
export const codeSchema = z.object({
  type: z.literal("code"),
  language: z.string().optional(),
  code: z.string(),
});

/** SYNC ASSUMED (09 §9 open; M10 §2.4) — media: {"type":"media","items":[{"url","alt","caption"}]}. */
export const mediaItemSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional(),
});
export const mediaSchema = z.object({
  type: z.literal("media"),
  items: z.array(mediaItemSchema).min(1),
});

/** The discriminated union the renderer validates against (O(1) dispatch on `type`). */
export const componentSpecSchema = z.discriminatedUnion("type", [
  tableSchema,
  chartSchema,
  citationSchema,
  calloutSchema,
  codeSchema,
  mediaSchema,
]);

export type ComponentSpec = z.infer<typeof componentSpecSchema>;
export type TableSpec = z.infer<typeof tableSchema>;
export type ChartSpec = z.infer<typeof chartSchema>;
export type CitationSpec = z.infer<typeof citationSchema>;
export type CalloutSpec = z.infer<typeof calloutSchema>;
export type CodeSpec = z.infer<typeof codeSchema>;
export type MediaSpec = z.infer<typeof mediaSchema>;

/**
 * Validate one opaque spec (from Message.components) against the strict union.
 * Returns the typed spec, or null to DROP it (unknown/invalid type, malformed payload).
 * Never throws — the surrounding prose + sibling blocks must always render.
 */
export function safeParseComponent(raw: unknown): ComponentSpec | null {
  const parsed = componentSpecSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Normalize a message's whole opaque components array into typed, render-ready specs,
 * dropping every invalid block (defense-in-depth over the backend's own drop, M10 §2.5).
 */
export function normalizeComponents(
  raw: readonly unknown[] | undefined
): ComponentSpec[] {
  if (!raw || raw.length === 0) return [];
  const out: ComponentSpec[] = [];
  for (const item of raw) {
    const spec = safeParseComponent(item);
    if (spec) out.push(spec);
  }
  return out;
}
