import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let byok = true;
vi.mock("@/lib/flags", () => ({
  get flags() {
    return { byok, auth: true, streaming: false };
  },
}));

import { useChatStore, createMessage } from "@/features/chat/store/chat.store";
import { FREE_TIER_EXHAUSTED } from "@/features/chat/api/chat.schemas";
import { FreeTierExhaustedDialog } from "@/features/keys/components/free-tier-exhausted-dialog";
import { FREE_TIER_EXHAUSTED_TITLE } from "@/features/keys/copy";

function seedAssistant(errorCode?: string) {
  useChatStore.setState({
    messages: [
      createMessage({
        role: "assistant",
        content: "boom",
        status: "done",
        errorCode,
      }),
    ],
  });
}

describe("FreeTierExhaustedDialog", () => {
  beforeEach(() => {
    byok = true;
    useChatStore.setState({ messages: [] });
  });

  it("opens with the BYOK CTA when a turn fails with free_tier_exhausted", () => {
    seedAssistant(FREE_TIER_EXHAUSTED);
    render(<FreeTierExhaustedDialog />);

    expect(screen.getByText(FREE_TIER_EXHAUSTED_TITLE)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /add your api key/i });
    expect(cta).toHaveAttribute("href", "/settings");
  });

  it("does NOT open for a generic (non-free-tier) error", () => {
    seedAssistant("some_other_error");
    render(<FreeTierExhaustedDialog />);
    expect(
      screen.queryByText(FREE_TIER_EXHAUSTED_TITLE)
    ).not.toBeInTheDocument();
  });

  it("does NOT open when there is no error code", () => {
    seedAssistant(undefined);
    render(<FreeTierExhaustedDialog />);
    expect(
      screen.queryByText(FREE_TIER_EXHAUSTED_TITLE)
    ).not.toBeInTheDocument();
  });

  it("stays dismissed for the same message after the user closes it", async () => {
    const user = userEvent.setup();
    seedAssistant(FREE_TIER_EXHAUSTED);
    render(<FreeTierExhaustedDialog />);

    expect(screen.getByText(FREE_TIER_EXHAUSTED_TITLE)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /not now/i }));
    expect(
      screen.queryByText(FREE_TIER_EXHAUSTED_TITLE)
    ).not.toBeInTheDocument();
  });

  it("renders nothing when BYOK is off", () => {
    byok = false;
    seedAssistant(FREE_TIER_EXHAUSTED);
    const { container } = render(<FreeTierExhaustedDialog />);
    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByText(FREE_TIER_EXHAUSTED_TITLE)
    ).not.toBeInTheDocument();
  });
});
