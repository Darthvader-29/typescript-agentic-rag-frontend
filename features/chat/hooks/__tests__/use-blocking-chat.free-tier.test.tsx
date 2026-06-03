import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/features/chat/api/chat.api", () => ({
  sendMessage: vi.fn(),
}));

import { sendMessage } from "@/features/chat/api/chat.api";
import { useBlockingChat } from "@/features/chat/hooks/use-blocking-chat";
import { useChatStore } from "@/features/chat/store/chat.store";
import { ApiError } from "@/lib/api/api-error";

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("useBlockingChat — free_tier_exhausted code capture", () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], isLoading: false });
    vi.clearAllMocks();
  });

  it("captures errorCode from the ApiError payload {detail, code} (BYOK CTA hook)", async () => {
    // The free-tier guard arrives as an HTTP 4xx whose JSON body carries the code; the
    // http-client stashes the parsed body on ApiError.payload.
    (sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError({
        message: "Free tier exhausted",
        status: 402,
        kind: "http",
        detail: "Free tier exhausted",
        payload: { detail: "Free tier exhausted", code: "free_tier_exhausted" },
      })
    );

    const { result } = renderHook(() => useBlockingChat(), { wrapper });
    act(() => result.current.sendMessage("q", false));

    await waitFor(() => {
      const assistant = useChatStore.getState().messages[1];
      expect(assistant.route).toBe("ERROR");
      expect(assistant.status).toBe("error");
      expect(assistant.errorCode).toBe("free_tier_exhausted");
    });
  });

  it("leaves errorCode undefined for a generic error (no code in payload)", async () => {
    (sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Gemini 500")
    );
    const { result } = renderHook(() => useBlockingChat(), { wrapper });
    act(() => result.current.sendMessage("q", false));

    await waitFor(() => {
      const assistant = useChatStore.getState().messages[1];
      expect(assistant.route).toBe("ERROR");
      expect(assistant.errorCode).toBeUndefined();
    });
  });
});
