import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalloutComponent } from "@/features/chat/components/rich/callout";
import type { CalloutSpec } from "@/features/chat/components/rich/component.schemas";

describe("CalloutComponent", () => {
  it("renders the text and an optional title", () => {
    const spec: CalloutSpec = {
      type: "callout",
      level: "info",
      title: "Note",
      text: "Body copy here.",
    };
    render(<CalloutComponent spec={spec} />);
    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText("Body copy here.")).toBeInTheDocument();
  });

  it("maps level=warning → role='alert'", () => {
    const spec: CalloutSpec = {
      type: "callout",
      level: "warning",
      text: "Careful.",
    };
    render(<CalloutComponent spec={spec} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Careful.");
  });

  it("maps level=info → role='note'", () => {
    const spec: CalloutSpec = { type: "callout", level: "info", text: "FYI." };
    render(<CalloutComponent spec={spec} />);
    expect(screen.getByRole("note")).toHaveTextContent("FYI.");
  });

  it("maps level=tip → role='note' with the tip tone token", () => {
    const spec: CalloutSpec = {
      type: "callout",
      level: "tip",
      text: "Pro tip.",
    };
    const { container } = render(<CalloutComponent spec={spec} />);
    expect(screen.getByRole("note")).toHaveTextContent("Pro tip.");
    // tip uses the chart-2 token tone (semantic, not hardcoded hex).
    expect(container.querySelector(".bg-chart-2\\/5")).not.toBeNull();
  });
});
