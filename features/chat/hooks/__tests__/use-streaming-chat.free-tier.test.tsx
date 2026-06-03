import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { StreamError } from "@/lib/sse/stream-chat";

// A controllable streamChat: each test sets `script` to the handler sequence to replay.
let script: (h: Record<string, (...a: unknown[]) => void>) => void = () => {};
vi.mock("@/lib/sse/stream-chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sse/stream-chat")>(
    "@/lib/sse/stream-chat"
  );
  return {
    ...actual, // keep the real StreamError class
    streamChat: vi.fn(
      async (_payload: unknown, h: Record<string, (...a: unknown[]) => void>) =>
        script(h)
    ),
  };
});

import { useChatStore } from "@/features/chat/store/chat.store";
import { useStreamingChat } from "@/features/chat/hooks/use-streaming-chat";

describe("useStreamingChat — free_tier_exhausted + citation sources", () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], isStreaming: false });
  });

  it("captures errorCode = free_tier_exhausted on the finalized message (BYOK CTA hook)", async () => {
    script = (h) => {
      h.onToken?.("partial ");
      h.onError?.(
        new StreamError("Free tier exhausted", "free_tier_exhausted")
      );
    };
    const { result } = renderHook(() => useStreamingChat());
    await act(async () => {
      await result.current.sendMessage("q", false);
    });

    const assistant = useChatStore
      .getState()
      .messages.find((m) => m.role === "assistant")!;
    expect(assistant.status).toBe("done"); // finalized cleanly (no throw past the hook)
    expect(assistant.route).toBe("ERROR");
    // The machine-readable code is captured so M7's BYOK CTA can key off it.
    expect(assistant.errorCode).toBe("free_tier_exhausted");
    // The error path surfaces a code-aware, BYOK-flavored message (not the generic one).
    expect(assistant.content).toContain("Free tier exhausted");
  });

  it("leaves errorCode undefined for a generic error", async () => {
    script = (h) => h.onError?.(new StreamError("boom"));
    const { result } = renderHook(() => useStreamingChat());
    await act(async () => {
      await result.current.sendMessage("q", false);
    });
    const assistant = useChatStore
      .getState()
      .messages.find((m) => m.role === "assistant")!;
    expect(assistant.route).toBe("ERROR");
    expect(assistant.errorCode).toBeUndefined();
  });

  it("derives sources from citation items (label/source_id/snippet) on done", async () => {
    script = (h) => {
      h.onComponent?.({
        type: "citation",
        items: [
          { label: "Doc A · p.1", source_id: "doc-a-1", snippet: "alpha" },
          { source_id: "doc-b-2" }, // no label → falls back to source_id as title
        ],
      });
      h.onDone?.({ answer: "grounded", route: "RAG" });
    };
    const { result } = renderHook(() => useStreamingChat());
    await act(async () => {
      await result.current.sendMessage("q", false);
    });

    const assistant = useChatStore
      .getState()
      .messages.find((m) => m.role === "assistant")!;
    expect(assistant.sources).toHaveLength(2);
    expect(assistant.sources[0]).toMatchObject({
      id: "doc-a-1",
      title: "Doc A · p.1",
      snippet: "alpha",
    });
    expect(assistant.sources[1]).toMatchObject({
      id: "doc-b-2",
      title: "doc-b-2",
    });
  });

  it("leaves sources empty (no fabricated count) when a turn emits no citation", async () => {
    script = (h) => h.onDone?.({ answer: "direct answer", route: "DIRECT" });
    const { result } = renderHook(() => useStreamingChat());
    await act(async () => {
      await result.current.sendMessage("q", false);
    });
    const assistant = useChatStore
      .getState()
      .messages.find((m) => m.role === "assistant")!;
    expect(assistant.sources).toEqual([]);
    expect(assistant.route).toBe("DIRECT");
  });
});
