// features/chat/components/rich/code.tsx
"use client";

import { CodeBlock } from "@/features/chat/components/code-block"; // M3: lazy highlighter + copy
import type { CodeSpec } from "./component.schemas";

export function CodeComponent({ spec }: { spec: CodeSpec }) {
  return <CodeBlock language={spec.language} value={spec.code} />;
}
