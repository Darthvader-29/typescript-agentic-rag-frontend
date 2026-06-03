// features/chat/components/rich/chart.tsx
"use client";

import dynamic from "next/dynamic";
import type { ChartSpec } from "./component.schemas";

// Lazy, client-only: the whole recharts tree (chart-impl) is pulled in ONLY when a chart block
// actually mounts. next/dynamic({ssr:false}) keeps recharts out of the chat route's first-load JS
// and off the server (D6 / R4). The skeleton holds the layout while the chunk arrives.
const ChartImpl = dynamic(() => import("./chart-impl"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted/40 h-64 w-full animate-pulse rounded-md" />
  ),
});

export function ChartComponent({ spec }: { spec: ChartSpec }) {
  return (
    <figure className="border-border bg-card my-3 rounded-md border p-3">
      {spec.title && (
        <figcaption className="text-muted-foreground mb-2 text-xs font-medium">
          {spec.title}
        </figcaption>
      )}
      <div
        className="h-64 w-full"
        role="img"
        aria-label={spec.title ?? "Chart"}
      >
        <ChartImpl spec={spec} />
      </div>
    </figure>
  );
}
