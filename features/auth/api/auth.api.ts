// features/auth/api/auth.api.ts
//
// Typed auth calls against backend Phase 6 (docs/09 Appendix C). The auth router is
// mounted UNDER /api (POST /api/auth/*), and NEXT_PUBLIC_API_URL already ends in "/api"
// (.env.example), so the relative paths below resolve to "<base>/auth/*" via the normal
// http-client base-prepend — no origin stripping needed.
//
// register/login/guest/upgrade all return a TokenPair. `refresh` is used ONLY by the
// interceptor's single-flight refresh (lib/api/http-client.ts); `upgrade` is the sole
// call made with auth:true, because it must run while authenticated as the guest so the
// backend preserves the same user_id.
import { request } from "@/lib/api/http-client";
import {
  TokenPairSchema,
  type TokenPair,
  type RegisterRequest,
  type LoginRequest,
  type UpgradeRequest,
  type RefreshRequest,
} from "./auth.schemas";

export const authApi = {
  register: (body: RegisterRequest): Promise<TokenPair> =>
    request<TokenPair>("/auth/register", {
      method: "POST",
      body,
      schema: TokenPairSchema,
      auth: false, // public endpoint — no token to attach
    }),

  login: (body: LoginRequest): Promise<TokenPair> =>
    request<TokenPair>("/auth/login", {
      method: "POST",
      body,
      schema: TokenPairSchema,
      auth: false,
    }),

  // Mints an anonymous guest. Frictionless chat: called silently on first load when no
  // token is stored (see guest-bootstrap / use-guest). Returns user_id for the guest.
  guest: (): Promise<TokenPair> =>
    request<TokenPair>("/auth/guest", {
      method: "POST",
      body: {},
      schema: TokenPairSchema,
      auth: false,
    }),

  // Upgrades the CURRENT guest to a registered account, preserving user_id. MUST be
  // sent authenticated as the guest (auth:true → Bearer attached by the interceptor).
  upgrade: (body: UpgradeRequest): Promise<TokenPair> =>
    request<TokenPair>("/auth/upgrade", {
      method: "POST",
      body,
      schema: TokenPairSchema,
      auth: true,
    }),

  // Interceptor-only. auth:false so refreshing never re-enters the Bearer/refresh path.
  refresh: (body: RefreshRequest): Promise<TokenPair> =>
    request<TokenPair>("/auth/refresh", {
      method: "POST",
      body,
      schema: TokenPairSchema,
      auth: false,
    }),
};
