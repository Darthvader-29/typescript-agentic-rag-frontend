// features/chat/components/rich/table.tsx
"use client";

import type { TableSpec } from "./component.schemas";

function cellText(v: string | number | boolean | null): string {
  return v === null ? "" : String(v);
}

export function TableComponent({ spec }: { spec: TableSpec }) {
  const { columns, rows, caption } = spec;
  return (
    <div className="border-border my-3 overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        {caption && (
          <caption className="text-muted-foreground px-3 py-2 text-left text-xs">
            {caption}
          </caption>
        )}
        <thead>
          <tr className="border-border bg-muted/60 border-b">
            {columns.map((col, i) => (
              <th
                key={i}
                scope="col"
                className="text-foreground px-3 py-2 text-left font-medium"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr
              key={r}
              className="border-border hover:bg-muted/40 border-b last:border-0"
            >
              {/* Iterate the COLUMN axis so ragged rows pad/clip to columns.length. */}
              {columns.map((_, c) => (
                <td
                  key={c}
                  className="text-muted-foreground px-3 py-2 align-top"
                >
                  {cellText(row[c] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
