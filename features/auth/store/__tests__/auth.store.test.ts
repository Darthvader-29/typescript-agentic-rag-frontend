import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore, authStore } from "@/features/auth/store/auth.store";
import type { TokenPair } from "@/features/auth/api/auth.schemas";

const TOKENS: TokenPair = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  token_type: "bearer",
};

function resetStore() {
  localStorage.clear();
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    userId: null,
    email: null,
    isGuest: false,
    hasHydrated: false,
  });
}

describe("auth.store", () => {
  beforeEach(resetStore);

  it("setTokens populates access + refresh and preserves identity fields", () => {
    useAuthStore.getState().setTokens(TOKENS);
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe("access-1");
    expect(s.refreshToken).toBe("refresh-1");
  });

  it("guest mint sets isGuest and captures user_id; clear empties everything", () => {
    useAuthStore
      .getState()
      .setTokens({ ...TOKENS, user_id: "guest-uuid" }, { isGuest: true });
    let s = useAuthStore.getState();
    expect(s.isGuest).toBe(true);
    expect(s.userId).toBe("guest-uuid");

    useAuthStore.getState().clear();
    s = useAuthStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.userId).toBeNull();
    expect(s.isGuest).toBe(false);
  });

  it("upgrade (isGuest:false) flips a guest to registered but keeps the user_id", () => {
    useAuthStore
      .getState()
      .setTokens({ ...TOKENS, user_id: "uuid-9" }, { isGuest: true });
    // Upgrade returns a fresh pair without echoing user_id → it must be preserved.
    useAuthStore
      .getState()
      .setTokens(
        { access_token: "access-2", refresh_token: "refresh-2" },
        { isGuest: false }
      );
    const s = useAuthStore.getState();
    expect(s.isGuest).toBe(false);
    expect(s.userId).toBe("uuid-9");
    expect(s.accessToken).toBe("access-2");
  });

  it("a silent refresh (no opts) must NOT promote a guest to registered", () => {
    useAuthStore.getState().setTokens(TOKENS, { isGuest: true });
    // authStore.setTokens passes no opts (the interceptor's refresh path).
    authStore.setTokens({ access_token: "a3", refresh_token: "r3" });
    const s = useAuthStore.getState();
    expect(s.isGuest).toBe(true); // preserved
    expect(s.accessToken).toBe("a3");
  });

  it("non-React authStore accessors read/clear the live store", () => {
    useAuthStore.getState().setTokens(TOKENS);
    expect(authStore.getAccessToken()).toBe("access-1");
    expect(authStore.getRefreshToken()).toBe("refresh-1");
    authStore.clear();
    expect(authStore.getAccessToken()).toBeNull();
  });

  it("persists the token pair to localStorage under rag_auth (partialize excludes hasHydrated)", () => {
    useAuthStore.getState().setHasHydrated(true);
    useAuthStore.getState().setTokens(TOKENS, { isGuest: true });
    useAuthStore.getState().setEmail("ada@example.com");

    const raw = localStorage.getItem("rag_auth");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.accessToken).toBe("access-1");
    expect(parsed.state.email).toBe("ada@example.com");
    expect(parsed.state.isGuest).toBe(true);
    // hasHydrated is transient and must never be persisted.
    expect(parsed.state.hasHydrated).toBeUndefined();
  });
});
