"use client";

import { useEffect } from "react";
import { flags } from "@/lib/flags";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useGuest } from "@/features/auth/hooks/use-guest";

/**
 * Frictionless-chat bootstrap. When `flags.auth` is ON and the store has hydrated with no
 * stored token, silently mint a guest (POST /api/auth/guest) so the user can chat without
 * a login wall. Renders nothing.
 *
 * Flag OFF → no-op (today's anonymous rag_session_id flow is untouched).
 * Backend not live yet → useGuest swallows the error and chat degrades to the anonymous
 * path; surfaced in the report as "pending backend", never blocks the UI.
 */
export function GuestBootstrap() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { ensureGuest } = useGuest();

  useEffect(() => {
    if (!flags.auth) return; // flag off → never mint a guest
    if (!hasHydrated) return; // wait for localStorage rehydration first
    if (accessToken) return; // already authenticated (guest or registered)
    void ensureGuest();
  }, [hasHydrated, accessToken, ensureGuest]);

  return null;
}
