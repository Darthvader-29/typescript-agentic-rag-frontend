"use client";

import { flags } from "@/lib/flags";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { GuestBootstrap } from "@/features/auth/components/guest-bootstrap";

/**
 * Soft, flag-gated guard for the chat surface. Guest-by-default (per the Phase 6 product
 * intent): auth is NOT a hard wall — an unauthenticated visitor is silently given a guest
 * identity rather than bounced to /login. This keeps chat frictionless even before the
 * backend guest endpoint is live (degrades to the anonymous path).
 *
 *  - Flag OFF → transparent passthrough (byte-for-byte today's anonymous flow).
 *  - Flag ON  → mount <GuestBootstrap> (mints a guest if needed) and render children. We
 *    render children even pre-hydration so chat never flashes blank; the request layer
 *    only attaches a Bearer once a token exists, and chat already degrades gracefully
 *    without one. /login and /register remain available as explicit opt-in entry points
 *    (via the user-menu), not a forced redirect.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  if (!flags.auth) return <>{children}</>;

  return (
    <>
      {/* Mint a guest once the store has hydrated and no token is present. */}
      {hasHydrated && <GuestBootstrap />}
      {children}
    </>
  );
}
