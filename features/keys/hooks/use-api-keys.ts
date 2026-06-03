// features/keys/hooks/use-api-keys.ts
//
// TanStack Query data layer for the BYOK key store (M7). One list query is the source of
// truth for "which providers are configured"; create/update/remove mutations invalidate it
// so the Settings form and the disclaimer banner re-derive from fresh server state.
//
// The query is gated on `flags.byok && isAuthenticated` — keys are user-scoped and the
// endpoint is Bearer-guarded, so we never fire it for an anonymous/flag-off session. When
// the gate is closed the hook returns an empty, non-loading list (no network, no error).
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { keysApi } from "@/features/keys/api/keys.api";
import {
  type KeyList,
  type SaveKeyRequest,
  type Provider,
} from "@/features/keys/api/keys.schemas";
import { providerLabel } from "@/features/keys/models";
import { flags } from "@/lib/flags";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { isApiError } from "@/lib/api/api-error";

/** Stable query key so mutations can target the list for invalidation. */
export const KEYS_QUERY_KEY = ["api-keys"] as const;

/**
 * Reads the user's stored keys. Enabled only when BYOK is live AND the user is
 * authenticated. Returns `keys: []` while disabled or loading so callers can render
 * "no keys" without special-casing `undefined`.
 */
export function useApiKeys() {
  const { isAuthenticated } = useAuth();
  const enabled = flags.byok && isAuthenticated;

  const query = useQuery({
    queryKey: KEYS_QUERY_KEY,
    queryFn: () => keysApi.list(),
    enabled,
    staleTime: 30_000,
  });

  return {
    keys: (query.data ?? []) as KeyList,
    isLoading: enabled && query.isLoading,
    isError: query.isError,
    error: query.error,
    enabled,
    refetch: query.refetch,
  };
}

/**
 * Creates or replaces a key. Routes to POST (create) vs PUT (update) based on whether a
 * key already exists for the provider, so the Settings form has a single "Save" action.
 * Invalidates the list on success so the UI reflects the new state.
 */
export function useSaveApiKey() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: SaveKeyRequest & { exists: boolean }) => {
      const body: SaveKeyRequest = {
        provider: vars.provider,
        api_key: vars.api_key,
      };
      return vars.exists ? keysApi.update(body) : keysApi.create(body);
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: KEYS_QUERY_KEY });
      toast.success(`${providerLabel(vars.provider)} key saved`);
    },
    onError: (err) => {
      const msg =
        isApiError(err) && err.userMessage
          ? err.userMessage
          : "Could not save the key. Please try again.";
      toast.error(msg);
    },
  });
}

/** Deletes a provider's key and invalidates the list. */
export function useDeleteApiKey() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (provider: Provider) => keysApi.remove(provider),
    onSuccess: (_res, provider) => {
      qc.invalidateQueries({ queryKey: KEYS_QUERY_KEY });
      toast.success(`${providerLabel(provider)} key removed`);
    },
    onError: (err) => {
      const msg =
        isApiError(err) && err.userMessage
          ? err.userMessage
          : "Could not remove the key. Please try again.";
      toast.error(msg);
    },
  });
}

/**
 * Convenience selector: true once the user has at least one stored key (any provider).
 * Drives the free-tier disclaimer (shown ONLY to keyless users) and the BYOK upsell.
 */
export function useHasAnyKey(): boolean {
  const { keys } = useApiKeys();
  return keys.length > 0;
}
