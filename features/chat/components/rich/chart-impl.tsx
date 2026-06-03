// features/chat/components/rich/chart-impl.tsx
//
// The actual recharts tree. Loaded ONLY via chart.tsx's next/dynamic({ssr:false}) wrapper, so
// recharts never enters the chat route's first-load JS and never runs on the server (D6 / R4).
// Keeping every recharts piece in ONE module (rather than per-subcomponent dynamic imports) lets
// recharts' child-type detection (which inspects children element types to place axes/bars) work
// correctly — lazy-wrapping each child would hide its real component type from the parent chart.
"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  AreaChart,
  PieChart,
  Bar,
  Line,
  Area,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useReducedMotion } from "@/hooks/use-reduced-motion"; // M4
import type { ChartSpec } from "./component.schemas";

// Semantic palette via the token utilities (resolve per-theme; no hardcoded hex).
const SERIES_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function color(i: number): string {
  return SERIES_COLORS[i % SERIES_COLORS.length];
}

/** Pivot {x, series[]} → recharts row objects: [{ x, [seriesName]: y }]. */
function toRows(spec: ChartSpec): Array<Record<string, string | number>> {
  return spec.x.map((label, i) => {
    const row: Record<string, string | number> = {
      x: typeof label === "number" ? label : String(label),
    };
    for (const s of spec.series) row[s.name] = s.y[i] ?? 0;
    return row;
  });
}

/** Pie uses only the FIRST series; each x label becomes a slice. */
function toPieData(spec: ChartSpec): Array<{ name: string; value: number }> {
  const first = spec.series[0];
  return spec.x.map((label, i) => ({
    name: typeof label === "number" ? String(label) : String(label),
    value: first.y[i] ?? 0,
  }));
}

export default function ChartImpl({ spec }: { spec: ChartSpec }) {
  const reduced = useReducedMotion();
  const animate = !reduced; // recharts animates series on mount by default (R6)
  const rows = React.useMemo(() => toRows(spec), [spec]);
  const pieData = React.useMemo(() => toPieData(spec), [spec]);

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
      <XAxis
        dataKey="x"
        tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
      />
      <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
      <Tooltip
        contentStyle={{
          background: "var(--color-popover)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          color: "var(--color-popover-foreground)",
          fontSize: 12,
        }}
      />
      <Legend wrapperStyle={{ fontSize: 12 }} />
    </>
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      {spec.chart === "line" ? (
        <LineChart data={rows}>
          {axes}
          {spec.series.map((s, i) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={color(i)}
              dot={false}
              isAnimationActive={animate}
            />
          ))}
        </LineChart>
      ) : spec.chart === "area" ? (
        <AreaChart data={rows}>
          {axes}
          {spec.series.map((s, i) => (
            <Area
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={color(i)}
              fill={color(i)}
              fillOpacity={0.2}
              isAnimationActive={animate}
            />
          ))}
        </AreaChart>
      ) : spec.chart === "pie" ? (
        <PieChart>
          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              color: "var(--color-popover-foreground)",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="80%"
            isAnimationActive={animate}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={color(i)} />
            ))}
          </Pie>
        </PieChart>
      ) : (
        <BarChart data={rows}>
          {axes}
          {spec.series.map((s, i) => (
            <Bar
              key={s.name}
              dataKey={s.name}
              fill={color(i)}
              isAnimationActive={animate}
            />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
