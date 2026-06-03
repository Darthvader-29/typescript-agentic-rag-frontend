"use client";

import { useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import { useChat, resetSession } from "@/features/chat/hooks/use-chat";
import { useChatStore, createMessage } from "@/features/chat/store/chat.store";
import { getSessionId } from "@/features/chat/api/chat.api";
import { env } from "@/lib/env";
import { spring } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

import { Sidebar } from "@/components/chat/sidebar";
import { ChatInput } from "@/components/chat/chat-input";
import { EmptyState } from "@/components/chat/empty-state";
import { MessageList } from "@/features/chat/components/message-list";
import { FreeTierBanner } from "@/features/keys/components/free-tier-banner";
import { FreeTierExhaustedDialog } from "@/features/keys/components/free-tier-exhausted-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { toast } from "sonner";

const sidebarVariants = {
  open: { width: 256, opacity: 1 },
  closed: { width: 0, opacity: 0 },
};

export function ChatScreen() {
  const { messages, sendMessage } = useChat();
  const isLoading = useChatStore((s) => s.isLoading);
  const addMessage = useChatStore((s) => s.addMessage);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Auto-scroll (ported from page.tsx:29-33).
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Cleanup beacon on tab close (ported from page.tsx:36-54).
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sessionId = getSessionId();
      if (!sessionId) return;
      const payload = JSON.stringify({ session_id: sessionId, file_keys: [] });
      navigator.sendBeacon(
        `${env.NEXT_PUBLIC_API_URL}/cleanup`,
        new Blob([payload], { type: "application/json" })
      );
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleClearSession = async () => {
    await resetSession();
    toast.success("Chat history cleared");
  };

  return (
    <div className="bg-background flex h-screen w-full overflow-hidden">
      {/* Spring-driven sidebar — replaces CSS width/opacity transition. */}
      <m.div
        initial={false}
        animate={isSidebarOpen ? "open" : "closed"}
        variants={sidebarVariants}
        transition={reduced ? { duration: 0 } : spring}
        className="overflow-hidden"
      >
        <Sidebar
          onClearSession={handleClearSession}
          onToggle={() => setIsSidebarOpen(false)}
        />
      </m.div>

      <div className="border-border bg-background relative my-0 mr-0 flex h-full flex-1 flex-col overflow-hidden rounded-l-2xl border-l shadow-xl dark:shadow-none">
        {!isSidebarOpen && (
          <div className="absolute top-4 left-4 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open sidebar"
              className="hover:bg-accent"
            >
              <Menu className="text-muted-foreground h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Free-tier disclaimer — flag-gated; visible only to keyless users (M7). */}
        <FreeTierBanner />

        {/* BYOK upsell — opens when a turn fails with free_tier_exhausted (M7). Portals. */}
        <FreeTierExhaustedDialog />

        <ScrollArea className="max-h-[calc(100vh-80px)] flex-1 p-4">
          <div className="mx-auto max-w-4xl space-y-6 pt-10 pb-10">
            {messages.length === 0 ? (
              <div className="mt-10">
                <EmptyState />
              </div>
            ) : (
              <MessageList messages={messages} isLoading={isLoading} />
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <ChatInput
          isLoading={isLoading}
          onSend={sendMessage}
          onFileUploaded={(fileName) => {
            addMessage(
              createMessage({
                role: "assistant",
                content: `📄 "${fileName}" uploaded and queued for ingestion.`,
                status: "done",
              })
            );
          }}
        />
      </div>
    </div>
  );
}
