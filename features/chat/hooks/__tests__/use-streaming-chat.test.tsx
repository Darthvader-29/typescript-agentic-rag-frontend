import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Replay a scripted SSE sequence by invoking the handlers streamChat would call.
// Scripts the 09 contract: a whole `component` block + a FLAT-enum done.route.
vi.mock("@/lib/sse/stream-chat", () => ({
  streamChat: vi.fn(
    async (
      _payload: unknown,
      h: Record<string, (...args: unknown[]) => void>
    ) => {
      h.onStatus?.("routing");
      h.onStatus?.("retrieving");
      h.onStatus?.("synthesizing");
      h.onToken?.("Grounded ");
      h.onToken?.("answer.");
      h.onComponent?.({
        type: "citation",
        items: [{ label: "doc.pdf · p.4" }],
      });
      h.onDone?.({ answer: "Grounded answer.", route: "BOTH" }); // flat enum (09)
    }
  ),
}));

import { useChatStore } from "@/features/chat/store/chat.store";
import { useStreamingChat } from "@/features/chat/hooks/use-streaming-chat";

describe("useStreamingChat end-to-end", () => {
  it("ends with a finalized assistant Message of the canonical shape", async () => {
    useChatStore.setState({ messages: [], isStreaming: false });
    const { result } = renderHook(() => useStreamingChat());

    await act(async () => {
      await result.current.sendMessage("what is X?", false);
    });

    const msgs = useChatStore.getState().messages;
    const assistant = msgs.find((m) => m.role === "assistant")!;
    expect(assistant.content).toBe("Grounded answer.");
    expect(assistant.route).toBe("WEB+RAG"); // mapRoute("BOTH") → "WEB+RAG"
    expect(assistant.status).toBe("done");
    expect(assistant.steps.map((s) => s.label)).toEqual([
      "routing",
      "retrieving",
      "synthesizing",
    ]);
    // Sources are DERIVED from the citation component (09 §5: citation = sources channel).
    expect(assistant.sources).toHaveLength(1);
    expect(assistant.sources[0].title).toBe("doc.pdf · p.4");
    // Opaque component ALSO captured for M10 rendering (storage is M9's job).
    expect(assistant.components).toHaveLength(1);
    expect(assistant.components![0].type).toBe("citation");
    expect(useChatStore.getState().isStreaming).toBe(false);
  });
});
