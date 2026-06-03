import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mutable flag, toggled per test (mirrors use-chat.facade.test.tsx / auth-guard.test.tsx).
vi.mock("@/lib/flags", () => ({ flags: { richComponents: true } }));

import { flags } from "@/lib/flags";
import { ComponentBlock } from "@/features/chat/components/rich/component-block";

function setFlag(on: boolean) {
  (flags as { richComponents: boolean }).richComponents = on;
}

const TABLE = {
  type: "table",
  columns: ["A", "B"],
  rows: [["1", "2"]],
};
const CALLOUT = { type: "callout", level: "warning", text: "watch out" };
const CODE = { type: "code", language: "ts", code: "const a = 1" };
const CHART = {
  type: "chart",
  chart: "bar",
  x: ["a"],
  series: [{ name: "s", y: [1] }],
};
const MEDIA = {
  type: "media",
  items: [{ url: "https://cdn.example.com/x.png", alt: "pic" }],
};
const CITATION = {
  type: "citation",
  items: [{ label: "doc.pdf", source_id: "s1" }],
};

describe("ComponentBlock — flag ON dispatches to the right renderer", () => {
  beforeEach(() => setFlag(true));

  it("renders the table renderer for a table spec", () => {
    render(<ComponentBlock spec={TABLE} />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });

  it("renders the callout renderer (role from level) for a callout spec", () => {
    render(<ComponentBlock spec={CALLOUT} />);
    expect(screen.getByRole("alert")).toHaveTextContent("watch out");
  });

  it("renders the code renderer (M3 code-block) for a code spec", () => {
    render(<ComponentBlock spec={CODE} />);
    expect(screen.getByText("ts")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy code/i })
    ).toBeInTheDocument();
  });

  it("renders the chart renderer (figure role=img) for a chart spec", () => {
    render(<ComponentBlock spec={CHART} />);
    // The figure chrome + aria-label render synchronously; recharts loads lazily below it.
    expect(screen.getByRole("img", { name: /chart/i })).toBeInTheDocument();
  });

  it("renders the media renderer for a media spec", () => {
    render(<ComponentBlock spec={MEDIA} />);
    expect(screen.getByAltText("pic")).toBeInTheDocument();
  });

  it("renders the citation renderer (sources panel) for a citation spec", () => {
    render(<ComponentBlock spec={CITATION} />);
    expect(screen.getByText(/Referenced 1 chunk/i)).toBeInTheDocument();
  });
});

describe("ComponentBlock — flag ON drops invalid specs (renders nothing)", () => {
  beforeEach(() => setFlag(true));

  it("renders null for an unknown type", () => {
    const { container } = render(<ComponentBlock spec={{ type: "widget" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders null for a malformed known type (missing required field)", () => {
    const { container } = render(
      <ComponentBlock spec={{ type: "table", columns: ["A"] }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders null for a non-object spec", () => {
    const { container } = render(<ComponentBlock spec={42} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ComponentBlock — flag OFF shows the collapsed raw-JSON fallback", () => {
  beforeEach(() => setFlag(false));

  it("renders a <details> disclosure containing the pretty-printed spec JSON", () => {
    render(<ComponentBlock spec={TABLE} />);
    // The disclosure summary labels the raw block…
    expect(screen.getByText(/Rich component \(raw\)/i)).toBeInTheDocument();
    // …and the JSON body is shown inside the M3 code-block (pretty-printed, so "type" appears).
    expect(screen.getByText(/"type": "table"/)).toBeInTheDocument();
  });

  it("shows the raw fallback even for an invalid spec (so the data is visible)", () => {
    render(<ComponentBlock spec={{ type: "widget", n: 1 }} />);
    expect(screen.getByText(/Rich component \(raw\)/i)).toBeInTheDocument();
    expect(screen.getByText(/"type": "widget"/)).toBeInTheDocument();
  });
});
