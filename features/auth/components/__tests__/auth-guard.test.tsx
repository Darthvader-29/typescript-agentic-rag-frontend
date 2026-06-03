import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mutable flag (toggled per test, mirroring use-chat.facade.test.tsx).
vi.mock("@/lib/flags", () => ({ flags: { auth: false } }));
// Stub GuestBootstrap so the guard test asserts ONLY the guard's own render behavior
// (the bootstrap's mint logic is covered by use-guest.test.ts).
vi.mock("@/features/auth/components/guest-bootstrap", () => ({
  GuestBootstrap: () => <div data-testid="guest-bootstrap" />,
}));

import { flags } from "@/lib/flags";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { useAuthStore } from "@/features/auth/store/auth.store";

function setHydrated(v: boolean) {
  useAuthStore.setState({ hasHydrated: v });
}

describe("AuthGuard", () => {
  beforeEach(() => {
    (flags as { auth: boolean }).auth = false;
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      userId: null,
      email: null,
      isGuest: false,
      hasHydrated: false,
    });
  });
  afterEach(() => vi.clearAllMocks());

  it("flag OFF: passthrough — renders children, no GuestBootstrap mounted", () => {
    (flags as { auth: boolean }).auth = false;
    render(
      <AuthGuard>
        <div data-testid="child">chat</div>
      </AuthGuard>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("guest-bootstrap")).not.toBeInTheDocument();
  });

  it("flag ON: renders children even before hydration (no blank flash, no redirect/wall)", () => {
    (flags as { auth: boolean }).auth = true;
    setHydrated(false);
    render(
      <AuthGuard>
        <div data-testid="child">chat</div>
      </AuthGuard>
    );
    // Children always render (guest-by-default is not a hard wall).
    expect(screen.getByTestId("child")).toBeInTheDocument();
    // Bootstrap only mounts once hydrated.
    expect(screen.queryByTestId("guest-bootstrap")).not.toBeInTheDocument();
  });

  it("flag ON + hydrated: mounts GuestBootstrap alongside children", () => {
    (flags as { auth: boolean }).auth = true;
    setHydrated(true);
    render(
      <AuthGuard>
        <div data-testid="child">chat</div>
      </AuthGuard>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByTestId("guest-bootstrap")).toBeInTheDocument();
  });
});
