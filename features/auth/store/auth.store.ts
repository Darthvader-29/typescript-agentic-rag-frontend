// features/auth/store/auth.store.ts
//
// Persisted Zustand token store (localStorage). The backend is a stateless JWT API that
// issues tokens in a JSON body and expects `Authorization: Bearer` (not cookies), so
// Bearer-from-localStorage is what the contract dictates. Tradeoff: localStorage tokens
// are XSS-readable — mitigated by short access TTL, markdown rendered with HTML disabled,
// and clear-on-logout. A BFF/httpOnly-cookie proxy is the documented upgrade path.
//
// Identity model (Phase 6): login/register return only a TokenPair, so we keep a
// lightweight identity — the typed `email` and, for a freshly minted guest, `userId` +
// `isGuest`. `hasHydrated` lets the guard / bootstrap wait for rehydration before acting.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TokenPair } from "@/features/auth/api/auth.schemas";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  /** Backend user id; populated from the guest mint (and preserved across upgrade). */
  userId: string | null;
  /** Email the user typed at login/register — used for the user-menu identity. */
  email: string | null;
  /** True while the current identity is an anonymous guest (drives the upgrade CTA). */
  isGuest: boolean;
  /** True once persist has rehydrated from storage; guard/bootstrap wait on this. */
  hasHydrated: boolean;

  /** Apply a fresh TokenPair. `isGuest` lets the caller tag a guest mint vs a real login. */
  setTokens: (tokens: TokenPair, opts?: { isGuest?: boolean }) => void;
  setEmail: (email: string | null) => void;
  clear: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      email: null,
      isGuest: false,
      hasHydrated: false,

      setTokens: (tokens, opts) =>
        set((s) => ({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          // Keep an existing userId if the backend omits it on refresh/login.
          userId: tokens.user_id ?? s.userId,
          // Only flip isGuest when the caller explicitly says so; otherwise preserve it
          // (a silent refresh must not promote a guest to a registered user).
          isGuest: opts?.isGuest ?? s.isGuest,
        })),
      setEmail: (email) => set({ email }),
      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          userId: null,
          email: null,
          isGuest: false,
        }),
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "rag_auth",
      storage: createJSONStorage(() => localStorage),
      // Persist identity + tokens; never persist the transient hydration flag.
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        userId: s.userId,
        email: s.email,
        isGuest: s.isGuest,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/**
 * Non-React accessors for the http-client interceptor (Task: single-flight refresh),
 * which runs OUTSIDE React and must read/write the store imperatively.
 */
export const authStore = {
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  setTokens: (t: TokenPair) => useAuthStore.getState().setTokens(t),
  clear: () => useAuthStore.getState().clear(),
};
