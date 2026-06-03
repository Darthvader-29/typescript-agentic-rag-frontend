import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CodeComponent } from "@/features/chat/components/rich/code";
import type { CodeSpec } from "@/features/chat/components/rich/component.schemas";

describe("CodeComponent (delegates to the M3 code-block)", () => {
  it("renders the language label and the code value", () => {
    const spec: CodeSpec = {
      type: "code",
      language: "python",
      code: "print('hi')",
    };
    render(<CodeComponent spec={spec} />);
    // M3 code-block shows the language in its chrome…
    expect(screen.getByText("python")).toBeInTheDocument();
    // …and the code value in the <pre> fallback before the lazy highlighter resolves.
    expect(screen.getByText("print('hi')")).toBeInTheDocument();
  });

  it("exposes a copy control (M3 code-block affordance)", () => {
    const spec: CodeSpec = { type: "code", code: "x = 1" };
    render(<CodeComponent spec={spec} />);
    expect(
      screen.getByRole("button", { name: /copy code/i })
    ).toBeInTheDocument();
  });

  it("falls back to a 'text' language label when language is omitted", () => {
    const spec: CodeSpec = { type: "code", code: "plain" };
    render(<CodeComponent spec={spec} />);
    expect(screen.getByText("text")).toBeInTheDocument();
  });
});
