"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { RegisterRequest } from "@/features/auth/api/auth.schemas";
import { isApiError } from "@/lib/api/api-error";

/**
 * Registers a brand-new account. Phase 6's /api/auth/register returns a TokenPair
 * directly (no separate login round-trip needed), which we persist and then redirect home.
 *
 * NOTE: this is "register from scratch" (no prior token). To convert an existing GUEST to
 * a registered account while preserving its user_id, use `useUpgrade` instead.
 */
export function useRegister() {
  const router = useRouter();
  const qc = useQueryClient();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setEmail = useAuthStore((s) => s.setEmail);

  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: (tokens, vars) => {
      setTokens(tokens, { isGuest: false });
      setEmail(vars.email);
      qc.clear();
      toast.success("Account created");
      router.replace("/");
    },
    onError: (err) => {
      const msg =
        isApiError(err) && err.status === 409
          ? "That email or username is already taken."
          : "Registration failed. Please try again.";
      toast.error(msg);
    },
  });
}
