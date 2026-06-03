import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { LazyMotion, domAnimation } from "framer-motion";

// End-to-end: a scripted SSE stream emits a whole `component` block mid-stream, the M9 plumbing
// (onComponent → addComponent) stores it on message.components, and M10's <ComponentBlock> renders
// it after the prose. This is the §8 "component-event end-to-end" gate (drive the real streaming
// hook + the real chat-message render path; only the transport is scripted).

// Scripted streamChat: each test sets `script` to the handler sequence to replay (mirrors the
// free-tier test). Keeps the real StreamError export intact.
let script: (h: Record<string, (...a: unknown[]) => void>) => void = () => {};
vi.mock("@/lib/sse/stream-chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sse/stream-chat")>(
    "@/lib/sse/stream-chat"
  );
  return {
    ...actual,
    streamChat: vi.fn(
      async (_p: unknown, h: Record<string, (...a: unknown[]) => void>) =>
        script(h)
    ),
  };
});

// Toggle rich-components per test.
vi.mock("@/lib/flags", () => ({ flags: { richComponents: true } }));
// Stub MessageActions (pulls useChat + Tooltip provider) — out of scope here.
vi.mock("@/features/chat/components/message-actions", () => ({
  MessageActions: () => <div data-testid="message-actions" />,
}));

import { flags } from "@/lib/flags";
import { useChatStore } from "@/features/chat/store/chat.store";
import { useStreamingChat } from "@/features/chat/hooks/use-streaming-chat";
import { ChatMessage } from "@/components/chat/chat-message";
import type { Message } from "@/types";

function setFlag(on: boolean) {
  (flags as { richComponents: boolean }).richComponents = on;
}

async function runStream(): Promise<Message> {
  const { result } = renderHook(() => useStreamingChat());
  await act(async () => {
    await result.current.sendMessage("show me a table", false);
  });
  return useChatStore.getState().messages.find((m) => m.role === "assistant")!;
}

function renderAssistant(message: Message) {
  return render(
    <LazyMotion features={domAnimation}>
      <ChatMessage message={message} />
    </LazyMotion>
  );
}

describe("component event → store → ComponentBlock (end-to-end)", () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], isStreaming: false });
    setFlag(true);
  });

  it("stores a streamed table block and renders it after the prose (flag ON)", async () => {
    script = (h) => {
      h.onStatus?.("synthesizing");
      h.onToken?.("Here is ");
      h.onToken?.("the data.");
      h.onComponent?.({
        type: "table",
        columns: ["Metric", "Value"],
        rows: [["Latency", 42]],
      });
      h.onDone?.({ answer: "Here is the data.", route: "RAG" });
    };

    const assistant = await runStream();
    // The whole block was captured opaquely by the M9 sink…
    expect(assistant.components).toHaveLength(1);
    expect(assistant.components![0].type).toBe("table");

    // …and M10 renders it (header cells) after the prose.
    renderAssistant(assistant);
    expect(screen.getByText("Here is the data.")).toBeInTheDocument();
    expect(
      screen.getAllByRole("columnheader").map((h) => h.textContent)
    ).toEqual(["Metric", "Value"]);
  });

  it("renders the raw-JSON fallback for the same stream when the flag is OFF", async () => {
    script = (h) => {
      h.onToken?.("Prose.");
      h.onComponent?.({
        type: "table",
        columns: ["A"],
        rows: [["1"]],
      });
      h.onDone?.({ answer: "Prose.", route: "RAG" });
    };
    const assistant = await runStream();

    setFlag(false);
    renderAssistant(assistant);
    expect(screen.getByText("Prose.")).toBeInTheDocument();
    expect(screen.getByText(/Rich component \(raw\)/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
  });

  it("drops a malformed component block and still renders the prose (no crash) — §2.5", async () => {
    script = (h) => {
      h.onToken?.("Grounded answer.");
      // Malformed table: missing rows. M9 stores it opaquely (loose schema), M10 drops it.
      h.onComponent?.({ type: "table", columns: ["A"] });
      h.onDone?.({ answer: "Grounded answer.", route: "RAG" });
    };
    const assistant = await runStream();
    // Stored opaquely (loose wire schema accepts {type: "table"})…
    expect(assistant.components).toHaveLength(1);

    // …but the strict render gate drops it; prose still renders, no table, no raw block (flag on).
    renderAssistant(assistant);
    expect(screen.getByText("Grounded answer.")).toBeInTheDocument();
    expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
    expect(
      screen.queryByText(/Rich component \(raw\)/i)
    ).not.toBeInTheDocument();
  });
});
