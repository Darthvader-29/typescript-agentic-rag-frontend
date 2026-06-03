// features/keys/models.ts
//
// The provider → model catalog for the per-conversation model picker. These are sensible,
// current options per provider; the backend's multi-provider abstraction accepts an
// optional `model` string on POST /api/chat (docs/09 Appendix C) and falls back to its own
// default when omitted. The catalog is intentionally a small curated set, not exhaustive.
import type { Provider } from "./api/keys.schemas";

export interface ModelOption {
  /** The exact `model` string sent to the backend on /api/chat. */
  id: string;
  /** Human label for the picker. */
  label: string;
}

export interface ProviderMeta {
  provider: Provider;
  label: string;
  models: ModelOption[];
}

/**
 * Curated model options per provider. The FIRST entry of each provider is its default —
 * selecting a provider in the picker seeds that model. Keep ids in sync with what the
 * backend's provider clients accept.
 */
export const PROVIDERS: ProviderMeta[] = [
  {
    provider: "gemini",
    label: "Google Gemini",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
  },
  {
    provider: "openai",
    label: "OpenAI",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4.1", label: "GPT-4.1" },
    ],
  },
  {
    provider: "anthropic",
    label: "Anthropic Claude",
    models: [
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { id: "claude-opus-4-1", label: "Claude Opus 4.1" },
    ],
  },
];

/** Display label for a provider (falls back to the raw id for an unknown provider). */
export function providerLabel(provider: Provider): string {
  return PROVIDERS.find((p) => p.provider === provider)?.label ?? provider;
}

/** The model options for a provider (empty array for an unknown provider). */
export function modelsFor(provider: Provider): ModelOption[] {
  return PROVIDERS.find((p) => p.provider === provider)?.models ?? [];
}

/** The default (first) model id for a provider, or undefined if none. */
export function defaultModelFor(provider: Provider): string | undefined {
  return modelsFor(provider)[0]?.id;
}

/** Human label for a (provider, modelId) pair; falls back to the raw id. */
export function modelLabel(provider: Provider, modelId: string): string {
  return modelsFor(provider).find((m) => m.id === modelId)?.label ?? modelId;
}
