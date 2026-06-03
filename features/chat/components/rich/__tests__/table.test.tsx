import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TableComponent } from "@/features/chat/components/rich/table";
import type { TableSpec } from "@/features/chat/components/rich/component.schemas";

describe("TableComponent", () => {
  it("renders a <th> per column and a <td> per column for each row", () => {
    const spec: TableSpec = {
      type: "table",
      columns: ["Metric", "Value"],
      rows: [
        ["Latency", 42],
        ["Uptime", "99.9%"],
      ],
    };
    render(<TableComponent spec={spec} />);

    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual(["Metric", "Value"]);

    // 2 data rows × 2 columns = 4 cells.
    expect(screen.getAllByRole("cell")).toHaveLength(4);
    expect(screen.getByText("Latency")).toBeInTheDocument();
    expect(screen.getByText("99.9%")).toBeInTheDocument();
  });

  it("tolerates a ragged row (fewer cells than columns) without throwing", () => {
    const spec: TableSpec = {
      type: "table",
      columns: ["A", "B", "C"],
      rows: [["only-one"]],
    };
    render(<TableComponent spec={spec} />);
    // Still renders exactly columns.length cells for the row (padded with empties).
    expect(screen.getAllByRole("cell")).toHaveLength(3);
    expect(screen.getByText("only-one")).toBeInTheDocument();
  });

  it("renders null cells as empty text (no 'null' leakage)", () => {
    const spec: TableSpec = {
      type: "table",
      columns: ["A"],
      rows: [[null]],
    };
    render(<TableComponent spec={spec} />);
    const cell = screen.getAllByRole("cell")[0];
    expect(cell.textContent).toBe("");
  });

  it("renders a cell string as text (no HTML injection)", () => {
    const spec: TableSpec = {
      type: "table",
      columns: ["X"],
      rows: [["<img src=x onerror=alert(1)>"]],
    };
    const { container } = render(<TableComponent spec={spec} />);
    // The string is rendered as text content, not parsed into an <img> element.
    expect(container.querySelector("img")).toBeNull();
    expect(
      screen.getByText("<img src=x onerror=alert(1)>")
    ).toBeInTheDocument();
  });

  it("renders an optional caption", () => {
    const spec: TableSpec = {
      type: "table",
      columns: ["A"],
      rows: [["1"]],
      caption: "Quarterly metrics",
    };
    render(<TableComponent spec={spec} />);
    expect(screen.getByText("Quarterly metrics")).toBeInTheDocument();
  });
});
