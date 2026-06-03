"use client";

import Link from "next/link";
import { LogOut, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/use-auth";

/**
 * Sidebar identity block (flag-on only). Two states:
 *  - Guest: a clear "Register to save your keys" upgrade entry → /register (which the
 *    register-form turns into an in-place upgrade preserving user_id).
 *  - Registered: avatar + email + logout.
 *
 * Renders nothing when unauthenticated (e.g. before the guest mint resolves).
 */
export function UserMenu() {
  const { isAuthenticated, isGuest, email, logout } = useAuth();
  if (!isAuthenticated) return null;

  if (isGuest) {
    return (
      <div className="border-border flex flex-col gap-2 border-t p-2">
        <p className="text-muted-foreground px-1 text-xs">
          You&apos;re chatting as a guest.
        </p>
        <Button
          asChild
          variant="outline"
          className="w-full justify-center gap-2"
        >
          <Link href="/register">
            <UserPlus className="h-4 w-4" />
            Register to save your keys
          </Link>
        </Button>
      </div>
    );
  }

  const label = email ?? "Account";
  const initial = (email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="border-border flex items-center gap-2 border-t p-2">
      <Avatar className="h-7 w-7">
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      <span className="flex-1 truncate text-sm" title={label}>
        {label}
      </span>
      <Button variant="ghost" size="icon" aria-label="Log out" onClick={logout}>
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
