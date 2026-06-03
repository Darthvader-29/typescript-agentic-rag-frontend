import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Controllable reduced-motion (M4 hook) — toggled per test.
let reduced = false;
vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => reduced,
}));

// Lightweight recharts stand-ins that record the props the chart-impl passes (so we can assert
// chart-type selection + isAnimationActive without rendering real SVG). Each records into `calls`.
const calls: { name: string; props: Record<string, unknown> }[] = [];
function rec(name: string) {
  const Recorder = ({
    children,
    ...props
  }: { children?: React.ReactNode } & Record<string, unknown>) => {
    calls.push({ name, props });
    return <div data-recharts={name}>{children as React.ReactNode}</div>;
  };
  Recorder.displayName = `Recharts(${name})`;
  return Recorder;
}
vi.mock("recharts", () => ({
  ResponsiveContainer: rec("ResponsiveContainer"),
  BarChart: rec("BarChart"),
  LineChart: rec("LineChart"),
  AreaChart: rec("AreaChart"),
  PieChart: rec("PieChart"),
  Bar: rec("Bar"),
  Line: rec("Line"),
  Area: rec("Area"),
  Pie: rec("Pie"),
  Cell: rec("Cell"),
  XAxis: rec("XAxis"),
  YAxis: rec("YAxis"),
  CartesianGrid: rec("CartesianGrid"),
  Tooltip: rec("Tooltip"),
  Legend: rec("Legend"),
}));

import { ChartComponent } from "@/features/chat/components/rich/chart";
import type { ChartSpec } from "@/features/chat/components/rich/component.schemas";

function chartsOfType(name: string) {
  return calls.filter((c) => c.name === name);
}

const BAR: ChartSpec = {
  type: "chart",
  chart: "bar",
  x: ["Q1", "Q2"],
  series: [
    { name: "Revenue", y: [10, 20] },
    { name: "Cost", y: [5, 8] },
  ],
  title: "Quarterly",
};

describe("ChartComponent (lazy recharts)", () => {
  beforeEach(() => {
    reduced = false;
    calls.length = 0;
  });

  it("renders the figure chrome (role=img + aria-label) synchronously", () => {
    render(<ChartComponent spec={BAR} />);
    expect(screen.getByRole("img", { name: "Quarterly" })).toBeInTheDocument();
  });

  it("mounts a bar chart with one <Bar> per series after the dynamic import resolves", async () => {
    render(<ChartComponent spec={BAR} />);
    await waitFor(() => expect(chartsOfType("BarChart").length).toBe(1));
    expect(chartsOfType("Bar")).toHaveLength(2); // one per series
  });

  it("selects a LineChart for chart='line'", async () => {
    render(<ChartComponent spec={{ ...BAR, chart: "line" }} />);
    await waitFor(() => expect(chartsOfType("LineChart").length).toBe(1));
    expect(chartsOfType("BarChart")).toHaveLength(0);
  });

  it("selects an AreaChart for chart='area'", async () => {
    render(<ChartComponent spec={{ ...BAR, chart: "area" }} />);
    await waitFor(() => expect(chartsOfType("AreaChart").length).toBe(1));
  });

  it("selects a PieChart for chart='pie'", async () => {
    render(<ChartComponent spec={{ ...BAR, chart: "pie" }} />);
    await waitFor(() => expect(chartsOfType("PieChart").length).toBe(1));
  });

  it("disables series animation under prefers-reduced-motion", async () => {
    reduced = true;
    render(<ChartComponent spec={BAR} />);
    await waitFor(() => expect(chartsOfType("Bar").length).toBe(2));
    for (const bar of chartsOfType("Bar")) {
      expect(bar.props.isAnimationActive).toBe(false);
    }
  });

  it("animates series when reduced-motion is off", async () => {
    reduced = false;
    render(<ChartComponent spec={BAR} />);
    await waitFor(() => expect(chartsOfType("Bar").length).toBe(2));
    for (const bar of chartsOfType("Bar")) {
      expect(bar.props.isAnimationActive).toBe(true);
    }
  });
});
