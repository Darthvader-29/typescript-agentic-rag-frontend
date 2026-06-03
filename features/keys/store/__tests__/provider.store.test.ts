import { describe, it, expect, beforeEach } from "vitest";
import {
  useProviderStore,
  getChatModelSelection,
} from "@/features/keys/store/provider.store";
import { defaultModelFor } from "@/features/keys/models";

function reset() {
  useProviderStore.setState({ provider: null, model: null });
}

describe("provider.store", () => {
  beforeEach(reset);

  it("defaults to no selection (backend default / free tier)", () => {
    const s = useProviderStore.getState();
    expect(s.provider).toBeNull();
    expect(s.model).toBeNull();
    expect(getChatModelSelection()).toEqual({});
  });

  it("setProvider seeds the provider's default model", () => {
    useProviderStore.getState().setProvider("anthropic");
    const s = useProviderStore.getState();
    expect(s.provider).toBe("anthropic");
    expect(s.model).toBe(defaultModelFor("anthropic"));
  });

  it("setProvider accepts an explicit model override", () => {
    useProviderStore.getState().setProvider("openai", "gpt-4o");
    expect(useProviderStore.getState().model).toBe("gpt-4o");
  });

  it("setModel refines the model within the current provider", () => {
    useProviderStore.getState().setProvider("gemini");
    useProviderStore.getState().setModel("gemini-2.5-pro");
    expect(useProviderStore.getState().model).toBe("gemini-2.5-pro");
  });

  it("clearSelection returns to the backend default", () => {
    useProviderStore.getState().setProvider("openai", "gpt-4o");
    useProviderStore.getState().clearSelection();
    const s = useProviderStore.getState();
    expect(s.provider).toBeNull();
    expect(s.model).toBeNull();
  });

  it("setProvider(null) clears any model", () => {
    useProviderStore.getState().setProvider("openai", "gpt-4o");
    useProviderStore.getState().setProvider(null);
    expect(useProviderStore.getState().model).toBeNull();
  });

  describe("getChatModelSelection (chat request body)", () => {
    it("returns {} when no provider is selected (request unchanged)", () => {
      expect(getChatModelSelection()).toEqual({});
    });

    it("returns provider + model when a model is chosen", () => {
      useProviderStore.getState().setProvider("anthropic", "claude-sonnet-4-5");
      expect(getChatModelSelection()).toEqual({
        provider: "anthropic",
        model: "claude-sonnet-4-5",
      });
    });

    it("returns provider only when model is somehow unset", () => {
      useProviderStore.setState({ provider: "gemini", model: null });
      expect(getChatModelSelection()).toEqual({ provider: "gemini" });
    });
  });
});
