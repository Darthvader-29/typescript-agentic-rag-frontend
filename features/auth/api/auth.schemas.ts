// features/auth/api/auth.schemas.ts
//
// Zod contracts for backend Phase 6 auth (docs/09 Appendix C — authoritative for M6):
//   POST /api/auth/register { email, username, password } -> TokenPair
//   POST /api/auth/login    { email, password }           -> TokenPair
//   POST /api/auth/guest    {}                             -> TokenPair + user_id
//   POST /api/auth/upgrade  { email, username, password }  -> upgrades same user_id
//   POST /api/auth/refresh  { refresh_token }              -> TokenPair   (interceptor only)
//
// Unlike the P3 doc, Phase 6 returns a TokenPair from BOTH register and login (no
// separate UserOut echo), and adds the frictionless guest + upgrade flow. The schemas
// are intentionally tolerant (token_type / user_id optional) so one shape covers every
// endpoint and a backend that omits an optional field still validates.
import { z } from "zod";

// --- Requests ---

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(64),
  // bcrypt truncates at 72 bytes; enforce a sane lower bound only, never pre-hash.
  password: z.string().min(8).max(72),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  // Backend returns a generic 401 on bad creds — don't over-validate here.
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// Upgrade reuses the register shape; the SAME (guest) user_id is preserved server-side
// because the call is made while authenticated as the guest (Bearer attached).
export const UpgradeRequestSchema = RegisterRequestSchema;
export type UpgradeRequest = z.infer<typeof UpgradeRequestSchema>;

export const RefreshRequestSchema = z.object({
  refresh_token: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

// --- Responses ---

// TokenPair covers register / login / guest / upgrade / refresh.
//  - token_type is optional ("bearer") — informational only.
//  - user_id is present on the guest mint (and harmlessly tolerated elsewhere); it lets
//    the store keep a lightweight identity for an anonymous guest before they register.
export const TokenPairSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  token_type: z.string().optional(),
  user_id: z.string().optional(),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

// Optional UserOut shape — Phase 6 login/register do not echo a user object, but a
// future backend (or /auth/me) might. Kept so identity typing is stable; unused on the
// happy path (the store derives identity from the typed email + guest user_id).
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
});
export type User = z.infer<typeof UserSchema>;
