// features/chat/components/rich/citation.tsx
"use client";

import { SourcesPanel } from "@/features/chat/components/sources-panel"; // M3
import type { CitationSpec } from "./component.schemas";
import type { Source } from "@/types";

/**
 * Map P6 citation items (provenance, 09 §5) → the M3 Source shape so they render through the
 * existing sources panel. A retrieved chunk has only source_id; a web source may have a url.
 */
function toSources(spec: CitationSpec): Source[] {
  return spec.items.map((item, i) => ({
    id: item.source_id ?? `citation-${i}`,
    title: item.label,
    snippet: item.snippet,
    url: item.url, // only http(s) URLs survived the strict schema (z.string().url())
  }));
}

export function CitationComponent({ spec }: { spec: CitationSpec }) {
  const sources = toSources(spec);
  // Reuse the M3 sources panel: same collapsible "Referenced N …" + cards, one provenance UX.
  return <SourcesPanel sources={sources} count={sources.length} />;
}
