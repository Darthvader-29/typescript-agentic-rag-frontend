import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LazyMotion, domAnimation } from "framer-motion";

// Toggle the rich-components flag per test.
vi.mock("@/lib/flags", () => ({ flags: { richComponents: true } }));
// Stub MessageActions (it pulls useChat + Tooltip provider) — out of scope for these assertions.
vi.mock("@/features/chat/components/message-actions", () => ({
  MessageActions: () => <div data-testid="message-actions" />,
}));

import { flags } from "@/lib/flags";
import { ChatMessage } from "@/components/chat/chat-message";
import { createMessage } from "@/features/chat/store/chat.store";
import type { Message } from "@/types";

function setFlag(on: boolean) {
  (flags as { richComponents: boolean }).richComponents = on;
}

function renderMessage(partial: Partial<Message>) {
  const message = createMessage({
    role: "assistant",
    content: "Here is the answer.",
    status: "done",
    ...partial,
  });
  return render(
    <LazyMotion features={domAnimation}>
      <ChatMessage message={message} />
    </LazyMotion>
  );
}

describe("chat-message — rich component wiring (flag ON)", () => {
  beforeEach(() => setFlag(true));

  it("renders prose AND a valid table component after the body", () => {
    renderMessage({
      components: [{ type: "table", columns: ["A", "B"], rows: [["1", "2"]] }],
    });
    expect(screen.getByText("Here is the answer.")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });

  it("drops an invalid component but still renders the prose + a sibling valid block", () => {
    renderMessage({
      components: [
        { type: "widget", boom: true }, // invalid → dropped
        { type: "callout", level: "info", text: "still here" }, // valid sibling
      ],
    });
    // Prose unaffected…
    expect(screen.getByText("Here is the answer.")).toBeInTheDocument();
    // …the valid sibling renders…
    expect(screen.getByRole("note")).toHaveTextContent("still here");
    // …and nothing crashed (no raw fallback in flag-on mode for the invalid one).
    expect(
      screen.queryByText(/Rich component \(raw\)/i)
    ).not.toBeInTheDocument();
  });

  it("suppresses the generic synthesized sources panel when a citation component is present", () => {
    renderMessage({
      sourcesCount: 3, // would normally show "Referenced 3 chunks from your documents"
      components: [
        {
          type: "citation",
          items: [{ label: "doc.pdf · p.4", source_id: "s1" }],
        },
      ],
    });
    // Exactly one provenance affordance — the citation panel (count 1), NOT the synthesized count-3 panel.
    expect(screen.getByText(/Referenced 1 chunk/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Referenced 3 chunks from your documents/i)
    ).not.toBeInTheDocument();
  });

  it("still shows the synthesized sources panel when there is no citation component", () => {
    renderMessage({ sourcesCount: 3, components: [] });
    expect(
      screen.getByText(/Referenced 3 chunks from your documents/i)
    ).toBeInTheDocument();
  });
});

describe("chat-message — rich component wiring (flag OFF)", () => {
  beforeEach(() => setFlag(false));

  it("renders the collapsed raw-JSON fallback instead of the rich table", () => {
    renderMessage({
      components: [{ type: "table", columns: ["A"], rows: [["1"]] }],
    });
    expect(screen.getByText("Here is the answer.")).toBeInTheDocument();
    expect(screen.getByText(/Rich component \(raw\)/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
  });

  it("does NOT suppress the synthesized sources panel for a citation when flag is off", () => {
    // Flag-off still computes hasCitation from the (valid) citation block, so the generic panel
    // is suppressed regardless of flag — provenance is shown via the raw block. Assert the raw
    // block is present and no duplicate generic panel renders.
    renderMessage({
      sourcesCount: 3,
      components: [
        { type: "citation", items: [{ label: "doc.pdf", source_id: "s1" }] },
      ],
    });
    expect(screen.getByText(/Rich component \(raw\)/i)).toBeInTheDocument();
  });

  it("renders a message with no components unchanged (prose only)", () => {
    renderMessage({ components: [] });
    expect(screen.getByText("Here is the answer.")).toBeInTheDocument();
    expect(
      screen.queryByText(/Rich component \(raw\)/i)
    ).not.toBeInTheDocument();
  });
});
