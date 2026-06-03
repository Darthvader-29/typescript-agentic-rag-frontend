"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegister } from "@/features/auth/hooks/use-register";
import { useUpgrade } from "@/features/auth/hooks/use-upgrade";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { RegisterRequestSchema } from "@/features/auth/api/auth.schemas";

/**
 * Create-account form. If the visitor is currently a GUEST, submitting upgrades the same
 * user_id (preserving their work) via /api/auth/upgrade; otherwise it registers a fresh
 * account via /api/auth/register. One surface, correct behavior either way.
 */
export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { isGuest } = useAuth();
  const register = useRegister();
  const upgrade = useUpgrade();
  const pending = register.isPending || upgrade.isPending;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = RegisterRequestSchema.safeParse({
      email,
      username,
      password,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details.");
      return;
    }
    setError(null);
    // Preserve a guest's user_id by upgrading in place; otherwise register from scratch.
    if (isGuest) upgrade.mutate(parsed.data);
    else register.mutate(parsed.data);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Create account</h1>
        <p className="text-muted-foreground text-sm">
          {isGuest
            ? "Register to save your keys and sessions — your current work is kept."
            : "Create an account to save your keys and sessions."}
        </p>
      </div>
      <div className="space-y-2">
        <Input
          placeholder="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
          aria-invalid={Boolean(error)}
        />
        <Input
          placeholder="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-label="Username"
          aria-invalid={Boolean(error)}
        />
        <Input
          placeholder="Password (min 8 characters)"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Password"
          aria-invalid={Boolean(error)}
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Have an account?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
