import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MediaComponent } from "@/features/chat/components/rich/media";
import type { MediaSpec } from "@/features/chat/components/rich/component.schemas";

describe("MediaComponent", () => {
  it("renders an allowlisted https image with no-referrer + lazy loading", () => {
    const spec: MediaSpec = {
      type: "media",
      items: [{ url: "https://cdn.example.com/a.png", alt: "an image" }],
    };
    render(<MediaComponent spec={spec} />);
    const img = screen.getByAltText("an image");
    expect(img).toHaveAttribute("src", "https://cdn.example.com/a.png");
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(img).toHaveAttribute("loading", "lazy");
  });

  it("renders an optional caption", () => {
    const spec: MediaSpec = {
      type: "media",
      items: [{ url: "https://cdn.example.com/a.png", caption: "Figure 1" }],
    };
    render(<MediaComponent spec={spec} />);
    expect(screen.getByText("Figure 1")).toBeInTheDocument();
  });

  it("renders the gallery grid for 2+ items", () => {
    const spec: MediaSpec = {
      type: "media",
      items: [
        { url: "https://cdn.example.com/a.png", alt: "a" },
        { url: "http://cdn.example.com/b.png", alt: "b" },
      ],
    };
    const { container } = render(<MediaComponent spec={spec} />);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(container.querySelector(".grid")).not.toBeNull();
  });

  it("filters out a non-http(s) URL (defense-in-depth) and renders nothing when all unsafe", () => {
    // A javascript:/data: URL can't be constructed via z.string().url() in the strict schema,
    // but the renderer re-checks the protocol as defense-in-depth. Construct the spec directly.
    const spec = {
      type: "media",
      items: [
        { url: "javascript:alert(1)" },
        { url: "data:text/html,<script>1</script>" },
      ],
    } as unknown as MediaSpec;
    const { container } = render(<MediaComponent spec={spec} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps only the safe items in a mixed list", () => {
    const spec = {
      type: "media",
      items: [
        { url: "https://cdn.example.com/ok.png", alt: "ok" },
        { url: "blob:https://evil/x" },
      ],
    } as unknown as MediaSpec;
    render(<MediaComponent spec={spec} />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByAltText("ok")).toBeInTheDocument();
  });
});
