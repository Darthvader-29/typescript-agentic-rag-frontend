"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { flags } from "@/lib/flags";
import { useChatStore } from "@/features/chat/store/chat.store";
import { FREE_TIER_EXHAUSTED } from "@/features/chat/api/chat.schemas";
import {
  FREE_TIER_EXHAUSTED_BODY,
  FREE_TIER_EXHAUSTED_TITLE,
} from "@/features/keys/copy";

/**
 * BYOK upsell dialog (M7). Opens when the most recent assistant turn carries
 * `errorCode === "free_tier_exhausted"` (docs/09 §3) — delivered via EITHER a pre-stream
 * HTTP 4xx or a terminal SSE error event; both funnel through the message's `errorCode`, so
 * this component is delivery-path agnostic.
 *
 * Open state is DERIVED during render (no setState-in-effect): the dialog shows while the
 * offending message id differs from the last-dismissed id. Closing records that id, so it
 * won't reopen on the next render; a fresh exhausted turn (new id) re-triggers it.
 * Renders nothing when BYOK is off.
 */
export function FreeTierExhaustedDialog() {
  const messages = useChatStore((s) => s.messages);
  // The id of the offending message the user has already dismissed.
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  // Most recent assistant message flagged free_tier_exhausted (if any).
  const offending = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.errorCode === FREE_TIER_EXHAUSTED);

  const open = Boolean(flags.byok && offending && offending.id !== dismissedId);

  if (!flags.byok) return null;

  const dismiss = () => {
    if (offending) setDismissedId(offending.id);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{FREE_TIER_EXHAUSTED_TITLE}</DialogTitle>
          <DialogDescription>{FREE_TIER_EXHAUSTED_BODY}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={dismiss}>
            Not now
          </Button>
          <Button asChild>
            <Link href="/settings" onClick={dismiss}>
              <KeyRound className="h-4 w-4" />
              Add your API key
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
