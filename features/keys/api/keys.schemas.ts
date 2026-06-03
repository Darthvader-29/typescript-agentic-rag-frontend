// features/keys/api/keys.schemas.ts
//
// Zod contracts for the backend Phase-4 BYOK key store, addressed by provider
// (docs/09 Appendix C — authoritative for M7):
//   GET    /api/keys                          -> KeyMeta[]   (never echoes the secret)
//   POST   /api/keys            { provider, api_key } -> { id, provider }   (201)
//   PUT    /api/keys/{provider} { provider, api_key } -> { id, provider }
//   DELETE /api/keys/{provider}               -> 204
//
// The list response is the ONLY way the UI learns which providers have a stored key — the
// raw key is write-only (last4 is the sole hint the backend returns). Schemas are tolerant
// (label / last4 / created_at optional) so a leaner backend response still validates.
import { z } from "zod";

/**
 * The three BYOK providers the backend's multi-provider LLM abstraction supports
 * (Gemini / OpenAI / Anthropic). This is the discriminant for both the key store and the
 * per-conversation model picker; an out-of-set provider is contract drift and is rejected.
 */
export const ProviderSchema = z.enum(["gemini", "openai", "anthropic"]);
export type Provider = z.infer<typeof ProviderSchema>;

// --- Requests ---

/**
 * Create/replace a key. The backend keys on `provider` (one key per provider per user), so
 * POST and PUT share this body; PUT also carries the provider in the path. `api_key` is a
 * raw secret — minimal validation (non-empty); the backend validates it against the vendor.
 */
export const SaveKeyRequestSchema = z.object({
  provider: ProviderSchema,
  api_key: z.string().min(1, "API key is required."),
});
export type SaveKeyRequest = z.infer<typeof SaveKeyRequestSchema>;

// --- Responses ---

/**
 * One stored key's metadata (list response item). The secret is never returned; `last4`
 * (when present) is the only display hint. `created_at` is an ISO string when present.
 */
export const KeyMetaSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  provider: ProviderSchema,
  label: z.string().optional(),
  last4: z.string().optional(),
  created_at: z.string().optional(),
});
export type KeyMeta = z.infer<typeof KeyMetaSchema>;

export const KeyListSchema = z.array(KeyMetaSchema);
export type KeyList = z.infer<typeof KeyListSchema>;

/** POST/PUT echo — the saved key's id + provider (the secret is never returned). */
export const SaveKeyResponseSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  provider: ProviderSchema,
});
export type SaveKeyResponse = z.infer<typeof SaveKeyResponseSchema>;
