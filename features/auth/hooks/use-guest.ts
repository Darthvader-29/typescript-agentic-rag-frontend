"use client";

import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/auth.store";

// Module-level single-flight guard: even if several components mount the bootstrap, the
// guest is minted exactly once per page load (and never if a token already exists).
let guestInFlight: Promise<void> | null = null;

/**
 * Mints an anonymous guest for frictionless chat. Used by <GuestBootstrap> on first load
 * when `flags.auth` is on and no token is stored. Degrades gracefully: if /api/auth/guest
 * is not live yet (backend Phase 6 in parallel), the error is swallowed — chat must not be
 * walled off by a missing guest endpoint (flag this as "pending backend").
 */
export function useGuest() {
  const setTokens = useAuthStore((s) => s.setTokens);

  const mutation = useMutation({
    mutationFn: () => authApi.guest(),
    onSuccess: (tokens) => {
      setTokens(tokens, { isGuest: true });
    },
    // Intentionally no toast on error — guest mint is invisible; failure degrades to the
    // anonymous (flag-off-equivalent) path rather than surfacing a scary error.
  });

  const { mutateAsync } = mutation;

  const ensureGuest = useCallback(async (): Promise<void> => {
    // Already have a token (guest or registered) → nothing to do.
    if (useAuthStore.getState().accessToken) return;
    if (guestInFlight) return guestInFlight;

    guestInFlight = mutateAsync()
      .then(() => undefined)
      .catch(() => undefined) // swallow: pending-backend degrades to anonymous chat
      .finally(() => {
        guestInFlight = null;
      });

    return guestInFlight;
  }, [mutateAsync]);

  return { ...mutation, ensureGuest };
}
