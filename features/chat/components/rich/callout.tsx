// features/chat/components/rich/callout.tsx
"use client";

import { Info, AlertTriangle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalloutSpec } from "./component.schemas";

// level → tone (semantic tokens, no hardcoded hex) + icon + ARIA role.
const LEVEL = {
  info: {
    Icon: Info,
    box: "border-primary/30 bg-primary/5",
    icon: "text-primary",
    role: "note",
  },
  warning: {
    Icon: AlertTriangle,
    box: "border-destructive/30 bg-destructive/5",
    icon: "text-destructive",
    role: "alert",
  },
  tip: {
    Icon: Lightbulb,
    box: "border-chart-2/30 bg-chart-2/5",
    icon: "text-chart-2",
    role: "note",
  },
} as const;

export function CalloutComponent({ spec }: { spec: CalloutSpec }) {
  const { level, text, title } = spec;
  const { Icon, box, icon, role } = LEVEL[level];
  return (
    <div
      role={role}
      className={cn("my-3 flex gap-3 rounded-md border p-3 text-sm", box)}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", icon)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="text-foreground mb-0.5 font-medium">{title}</p>}
        <p className="text-muted-foreground whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}
