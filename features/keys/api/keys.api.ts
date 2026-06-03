// features/keys/api/keys.api.ts
//
// Typed BYOK key-store calls against backend Phase 4 (docs/09 Appendix C). Every endpoint
// is Bearer-guarded (keys are user-scoped secrets), so all calls use auth:true — the
// http-client interceptor attaches the access token and runs the 401→refresh→retry dance.
// The router is mounted under /api and NEXT_PUBLIC_API_URL already ends in "/api", so the
// relative paths resolve to "<base>/keys[...]" via the normal base-prepend.
import { request } from "@/lib/api/http-client";
import {
  KeyListSchema,
  SaveKeyResponseSchema,
  type KeyList,
  type SaveKeyRequest,
  type SaveKeyResponse,
  type Provider,
} from "./keys.schemas";

export const keysApi = {
  // Lists the user's stored keys (metadata only — the secret is never returned). This is
  // the source of truth for which providers are configured.
  list: (): Promise<KeyList> =>
    request<KeyList>("/keys", {
      method: "GET",
      schema: KeyListSchema,
      auth: true,
    }),

  // Creates a key for a provider (201). The backend stores one key per provider; if one
  // already exists, prefer `update` (PUT) — but the hook routes by current list state.
  create: (body: SaveKeyRequest): Promise<SaveKeyResponse> =>
    request<SaveKeyResponse>("/keys", {
      method: "POST",
      body,
      schema: SaveKeyResponseSchema,
      auth: true,
    }),

  // Replaces the key for an existing provider (addressed by provider in the path).
  update: (body: SaveKeyRequest): Promise<SaveKeyResponse> =>
    request<SaveKeyResponse>(`/keys/${body.provider}`, {
      method: "PUT",
      body,
      schema: SaveKeyResponseSchema,
      auth: true,
    }),

  // Deletes the key for a provider (204 — no body; http-client returns void on 204).
  remove: (provider: Provider): Promise<void> =>
    request<void>(`/keys/${provider}`, {
      method: "DELETE",
      auth: true,
    }),
};
