// features/chat/components/rich/media.tsx
"use client";

import { cn } from "@/lib/utils";
import type { MediaSpec } from "./component.schemas";

/** Defense-in-depth over the schema: only ever load http(s) URLs (no data:, blob:, javascript:). */
function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function MediaComponent({ spec }: { spec: MediaSpec }) {
  const items = spec.items.filter((it) => isSafeHttpUrl(it.url));
  if (items.length === 0) return null; // nothing safe to show → drop (prose still renders)

  const isGallery = items.length > 1;
  return (
    <div
      className={cn(
        "my-3",
        isGallery ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "max-w-full"
      )}
    >
      {items.map((it, i) => (
        <figure
          key={i}
          className="border-border bg-muted/40 overflow-hidden rounded-md border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- external, allowlisted, no-referrer */}
          <img
            src={it.url}
            alt={it.alt ?? ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-auto w-full object-cover"
          />
          {it.caption && (
            <figcaption className="text-muted-foreground px-2 py-1 text-xs">
              {it.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
