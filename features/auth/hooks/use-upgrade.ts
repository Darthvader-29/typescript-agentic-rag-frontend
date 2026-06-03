"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { UpgradeRequest } from "@/features/auth/api/auth.schemas";
import { isApiError } from "@/lib/api/api-error";

/**
 * Upgrades the CURRENT guest to a registered account, preserving the same user_id.
 *
 * The request is sent authenticated as the guest (authApi.upgrade uses auth:true, so the
 * interceptor attaches the guest's Bearer). The backend keeps the user_id and returns a
 * fresh TokenPair for the now-registered user, which replaces the guest tokens in place.
 * We do NOT clear the Query cache here — the user_id (and thus their sessions/keys) carry
 * over, so caches remain valid.
 */
export function useUpgrade() {
  const router = useRouter();
  const qc = useQueryClient();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setEmail = useAuthStore((s) => s.setEmail);

  return useMutation({
    mutationFn: (body: UpgradeRequest) => authApi.upgrade(body),
    onSuccess: (tokens, vars) => {
      setTokens(tokens, { isGuest: false }); // guest → registered, same user_id
      setEmail(vars.email);
      // Keys/sessions are user-scoped and the user_id is unchanged, but the freshly saved
      // identity may unlock new queries — refresh rather than wipe.
      qc.invalidateQueries();
      toast.success("Account created — your work is saved");
      router.replace("/");
    },
    onError: (err) => {
      const msg =
        isApiError(err) && err.status === 409
          ? "That email or username is already taken."
          : "Could not create your account. Please try again.";
      toast.error(msg);
    },
  });
}
