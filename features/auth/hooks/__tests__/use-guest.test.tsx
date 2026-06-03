import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const guest = vi.fn();
vi.mock("@/features/auth/api/auth.api", () => ({
  authApi: { guest: () => guest() },
}));

import { useGuest } from "@/features/auth/hooks/use-guest";
import { useAuthStore } from "@/features/auth/store/auth.store";

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

function resetAuth() {
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    userId: null,
    email: null,
    isGuest: false,
    hasHydrated: true,
  });
}

describe("useGuest.ensureGuest", () => {
  beforeEach(() => {
    guest.mockReset();
    resetAuth();
  });

  it("mints a guest and stores tokens with isGuest=true + user_id", async () => {
    guest.mockResolvedValue({
      access_token: "g-access",
      refresh_token: "g-refresh",
      user_id: "guest-1",
    });

    const { result } = renderHook(() => useGuest(), { wrapper });
    await act(async () => {
      await result.current.ensureGuest();
    });

    await waitFor(() => {
      const s = useAuthStore.getState();
      expect(s.accessToken).toBe("g-access");
      expect(s.isGuest).toBe(true);
      expect(s.userId).toBe("guest-1");
    });
    expect(guest).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when a token already exists (does not re-mint)", async () => {
    useAuthStore.setState({ accessToken: "existing" });
    const { result } = renderHook(() => useGuest(), { wrapper });
    await act(async () => {
      await result.current.ensureGuest();
    });
    expect(guest).not.toHaveBeenCalled();
  });

  it("swallows a failing guest mint (degrades to anonymous — chat is never walled)", async () => {
    guest.mockRejectedValue(new Error("guest endpoint not live"));
    const { result } = renderHook(() => useGuest(), { wrapper });

    // Must resolve (not reject) — the error is intentionally swallowed.
    await act(async () => {
      await expect(result.current.ensureGuest()).resolves.toBeUndefined();
    });
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
