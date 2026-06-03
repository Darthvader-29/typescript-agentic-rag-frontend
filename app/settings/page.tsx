import type { Metadata } from "next";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { SettingsScreen } from "@/features/keys/components/settings-screen";

export const metadata: Metadata = {
  title: "Settings",
};

/**
 * BYOK settings route (M7). Wrapped in AuthGuard so that — when auth is on — a guest is
 * minted (frictionless) before the Bearer-guarded keys query runs. The SettingsScreen owns
 * the BYOK-flag + auth gating and renders the appropriate state.
 */
export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsScreen />
    </AuthGuard>
  );
}
