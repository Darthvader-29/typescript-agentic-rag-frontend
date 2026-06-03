import { describe, it, expect } from "vitest";
import {
  componentSpecSchema,
  safeParseComponent,
  normalizeComponents,
  type ComponentSpec,
} from "@/features/chat/components/rich/component.schemas";

/**
 * The strict union is the RENDER gate (M10 §2.5). These assertions pin it to the P6 catalog
 * (09 Appendix C): each sample parses to its typed spec, and anything off-catalog / malformed is
 * DROPPED (returns null) — the frontend mirror of the backend's "invalid block dropped" rule.
 */

// Appendix C verbatim samples (table/chart/citation/callout) + assumed code/media (§2.4).
const SAMPLES: Record<string, unknown> = {
  table: {
    type: "table",
    columns: ["Metric", "Value"],
    rows: [
      ["Latency", 42],
      ["Uptime", "99.9%"],
    ],
  },
  chart: {
    type: "chart",
    chart: "bar",
    x: ["Q1", "Q2"],
    series: [{ name: "Revenue", y: [10, 20] }],
  },
  citation: {
    type: "citation",
    items: [{ label: "doc.pdf · p.4", source_id: "s1", snippet: "…" }],
  },
  callout: { type: "callout", level: "warning", text: "Heads up." },
  code: { type: "code", language: "python", code: "print('hi')" },
  media: {
    type: "media",
    items: [{ url: "https://cdn.example.com/x.png", alt: "x" }],
  },
};

describe("component.schemas — strict union accepts each catalog sample", () => {
  it.each(Object.keys(SAMPLES))(
    "parses a %s spec to its typed shape",
    (type) => {
      const spec = safeParseComponent(SAMPLES[type]);
      expect(spec).not.toBeNull();
      expect((spec as ComponentSpec).type).toBe(type);
    }
  );

  it("applies the chart default (bar) when `chart` is omitted", () => {
    const spec = safeParseComponent({
      type: "chart",
      x: ["a"],
      series: [{ name: "s", y: [1] }],
    });
    expect(spec).toEqual(
      expect.objectContaining({ type: "chart", chart: "bar" })
    );
  });

  it("applies the callout default (info) when `level` is omitted", () => {
    const spec = safeParseComponent({ type: "callout", text: "x" });
    expect(spec).toEqual(
      expect.objectContaining({ type: "callout", level: "info" })
    );
  });

  it("accepts pie/line/area chart variants (contract Appendix C + M10 supersets)", () => {
    for (const chart of ["bar", "line", "pie", "area"]) {
      const spec = safeParseComponent({
        type: "chart",
        chart,
        x: ["a"],
        series: [{ name: "s", y: [1] }],
      });
      expect(spec).not.toBeNull();
    }
  });
});

describe("component.schemas — drop-invalid (returns null, never throws)", () => {
  it("drops an unknown / off-catalog type", () => {
    expect(safeParseComponent({ type: "widget", foo: 1 })).toBeNull();
    expect(
      safeParseComponent({ type: "Table", columns: [], rows: [] })
    ).toBeNull();
  });

  it("drops a block missing a required field", () => {
    expect(safeParseComponent({ type: "table", columns: ["a"] })).toBeNull(); // no rows
    expect(safeParseComponent({ type: "code" })).toBeNull(); // no code
    expect(safeParseComponent({ type: "citation", items: [] })).toBeNull(); // min(1)
    expect(safeParseComponent({ type: "chart", x: [], series: [] })).toBeNull(); // series min(1)
  });

  it("drops a non-http(s) media URL at the schema (z.string().url())", () => {
    expect(
      safeParseComponent({
        type: "media",
        items: [{ url: "not-a-url" }],
      })
    ).toBeNull();
  });

  it("drops non-objects and nullish input without throwing", () => {
    for (const bad of [null, undefined, 42, "table", [], true]) {
      expect(safeParseComponent(bad)).toBeNull();
    }
  });
});

describe("normalizeComponents — keeps only valid specs, order preserved", () => {
  it("returns [] for empty / undefined", () => {
    expect(normalizeComponents(undefined)).toEqual([]);
    expect(normalizeComponents([])).toEqual([]);
  });

  it("filters a mixed array to the valid specs, in order", () => {
    const out = normalizeComponents([
      SAMPLES.callout, // valid
      { type: "widget" }, // dropped
      SAMPLES.table, // valid
      { type: "code" }, // dropped (no code)
      SAMPLES.citation, // valid
    ]);
    expect(out.map((c) => c.type)).toEqual(["callout", "table", "citation"]);
  });
});

describe("componentSpecSchema is a discriminated union on `type`", () => {
  it("exposes discriminated-union semantics (errors key on type)", () => {
    const res = componentSpecSchema.safeParse({ type: "table" });
    expect(res.success).toBe(false);
  });
});
