import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// BYOK must be live for the keys query to enable.
vi.mock("@/lib/flags", () => ({
  flags: { byok: true, auth: true, streaming: false },
}));

// Authenticated user → the keys query is enabled.
let authState = { isAuthenticated: true };
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => authState,
}));

// Mock the network layer; assert the hooks call the right verb/args.
const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
vi.mock("@/features/keys/api/keys.api", () => ({
  keysApi: {
    list: () => list(),
    create: (b: unknown) => create(b),
    update: (b: unknown) => update(b),
    remove: (p: unknown) => remove(p),
  },
}));

// Silence the success/error toasts.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  useApiKeys,
  useSaveApiKey,
  useDeleteApiKey,
  useHasAnyKey,
} from "@/features/keys/hooks/use-api-keys";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

describe("useApiKeys (list)", () => {
  beforeEach(() => {
    authState = { isAuthenticated: true };
    list.mockReset();
    create.mockReset();
    update.mockReset();
    remove.mockReset();
  });

  it("fetches and exposes the stored keys when enabled", async () => {
    list.mockResolvedValue([
      { id: "1", provider: "gemini", last4: "1234" },
      { id: "2", provider: "openai" },
    ]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useApiKeys(), { wrapper });

    await waitFor(() => expect(result.current.keys).toHaveLength(2));
    expect(result.current.keys[0]).toMatchObject({
      provider: "gemini",
      last4: "1234",
    });
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("does NOT fetch when unauthenticated (gate closed) and returns []", async () => {
    authState = { isAuthenticated: false };
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useApiKeys(), { wrapper });

    expect(result.current.enabled).toBe(false);
    expect(result.current.keys).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(list).not.toHaveBeenCalled();
  });
});

describe("useSaveApiKey (create vs update routing)", () => {
  beforeEach(() => {
    authState = { isAuthenticated: true };
    list.mockReset();
    create.mockReset();
    update.mockReset();
    remove.mockReset();
  });

  it("POSTs (create) when the provider has no existing key", async () => {
    create.mockResolvedValue({ id: "9", provider: "anthropic" });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSaveApiKey(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        provider: "anthropic",
        api_key: "sk-ant-xxx",
        exists: false,
      });
    });

    expect(create).toHaveBeenCalledWith({
      provider: "anthropic",
      api_key: "sk-ant-xxx",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("PUTs (update) when a key already exists for the provider", async () => {
    update.mockResolvedValue({ id: "1", provider: "gemini" });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSaveApiKey(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        provider: "gemini",
        api_key: "new-key",
        exists: true,
      });
    });

    expect(update).toHaveBeenCalledWith({
      provider: "gemini",
      api_key: "new-key",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("invalidates the keys list after a successful save (refetch)", async () => {
    list.mockResolvedValue([]);
    create.mockResolvedValue({ id: "9", provider: "openai" });
    const { qc, wrapper } = makeWrapper();
    const invalidate = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useSaveApiKey(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        provider: "openai",
        api_key: "sk-openai",
        exists: false,
      });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["api-keys"] });
  });
});

describe("useDeleteApiKey", () => {
  beforeEach(() => {
    authState = { isAuthenticated: true };
    remove.mockReset();
    list.mockReset();
  });

  it("DELETEs the provider key and invalidates the list", async () => {
    remove.mockResolvedValue(undefined);
    const { qc, wrapper } = makeWrapper();
    const invalidate = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useDeleteApiKey(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("openai");
    });

    expect(remove).toHaveBeenCalledWith("openai");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["api-keys"] });
  });
});

describe("useHasAnyKey", () => {
  beforeEach(() => {
    authState = { isAuthenticated: true };
    list.mockReset();
  });

  it("is true once at least one key is stored", async () => {
    list.mockResolvedValue([{ id: "1", provider: "gemini" }]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useHasAnyKey(), { wrapper });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("is false when there are no keys", async () => {
    list.mockResolvedValue([]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useHasAnyKey(), { wrapper });
    // Stays false (no keys ever arrive).
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
