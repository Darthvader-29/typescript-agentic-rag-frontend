"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { flags } from "@/lib/flags";
import { useHasAnyKey } from "@/features/keys/hooks/use-api-keys";
import { FREE_TIER_DISCLAIMER } from "@/features/keys/copy";

/**
 * Free-tier disclaimer banner (M7). Shown ONLY to KEYLESS users — once any BYOK key is
 * stored the demo-mode warning no longer applies and the banner hides itself.
 *
 *  - BYOK flag OFF → renders nothing (the feature is dark).
 *  - BYOK flag ON, no stored key → show the CONTRACT-EXACT disclaimer + a "Add key" link.
 *  - BYOK flag ON, has a key → renders nothing.
 *
 * Keyless covers the anonymous/guest case too: `useHasAnyKey` is false when the keys query
 * is disabled (unauthenticated), so a demo visitor sees the warning.
 */
export function FreeTierBanner() {
  const hasKey = useHasAnyKey();

  if (!flags.byok || hasKey) return null;

  return (
    <div
      role="note"
      aria-label="Free tier notice"
      className="border-border bg-muted/40 text-muted-foreground flex items-start gap-2 border-b px-4 py-2 text-xs"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <p className="leading-relaxed">
        {FREE_TIER_DISCLAIMER}{" "}
        <Link
          href="/settings"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Add a key
        </Link>
      </p>
    </div>
  );
}
