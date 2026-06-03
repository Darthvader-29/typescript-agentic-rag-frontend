import { ChatScreen } from "@/features/chat/components/chat-screen";
import { AuthGuard } from "@/features/auth/components/auth-guard";

export default function Home() {
  // AuthGuard is a flag-gated passthrough: with NEXT_PUBLIC_FEATURE_AUTH off it renders the
  // chat screen unchanged; with it on it mints a guest (frictionless) and renders chat.
  return (
    <AuthGuard>
      <ChatScreen />
    </AuthGuard>
  );
}
