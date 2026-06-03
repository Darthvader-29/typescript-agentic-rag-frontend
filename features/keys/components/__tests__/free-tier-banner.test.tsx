import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { FREE_TIER_DISCLAIMER } from "@/features/keys/copy";

// Toggle BYOK per test via a mutable mock.
let byok = true;
vi.mock("@/lib/flags", () => ({
  get flags() {
    return { byok, auth: true, streaming: false };
  },
}));

// Control keyless state directly — the banner shows only to keyless users.
let hasKey = false;
vi.mock("@/features/keys/hooks/use-api-keys", () => ({
  useHasAnyKey: () => hasKey,
}));

import { FreeTierBanner } from "@/features/keys/components/free-tier-banner";

describe("FreeTierBanner", () => {
  beforeEach(() => {
    byok = true;
    hasKey = false;
  });

  it("shows the CONTRACT-EXACT disclaimer to keyless users", () => {
    render(<FreeTierBanner />);
    // Assert the exact copy from the contract is present verbatim.
    expect(
      screen.getByText(FREE_TIER_DISCLAIMER, { exact: false })
    ).toBeTruthy();
    // The literal string must match the contract byte-for-byte.
    expect(FREE_TIER_DISCLAIMER).toBe(
      "Demo mode runs on Google's free Gemini tier — please avoid uploading sensitive documents (data may be used per Google's policy). Add your own API key for private, unlimited use."
    );
    // And offers a path to add a key.
    expect(screen.getByRole("link", { name: /add a key/i })).toHaveAttribute(
      "href",
      "/settings"
    );
  });

  it("hides once the user has a stored key", () => {
    hasKey = true;
    const { container } = render(<FreeTierBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when BYOK is off", () => {
    byok = false;
    const { container } = render(<FreeTierBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
