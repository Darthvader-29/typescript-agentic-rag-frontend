"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { LoginRequest } from "@/features/auth/api/auth.schemas";
import { isApiError } from "@/lib/api/api-error";

/** Logs an existing user in, persists the TokenPair, and redirects to `next` or `/`. */
export function useLogin() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setEmail = useAuthStore((s) => s.setEmail);

  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (tokens, vars) => {
      setTokens(tokens, { isGuest: false }); // a real login is never a guest
      setEmail(vars.email); // contract returns no user object; email is the identity
      qc.clear(); // drop any prior (guest) session caches
      toast.success("Signed in");
      router.replace(params.get("next") ?? "/");
    },
    onError: (err) => {
      const msg =
        isApiError(err) && err.status === 401
          ? "Invalid email or password."
          : "Sign-in failed. Please try again.";
      toast.error(msg);
    },
  });
}
