import { z } from "zod";
import {
  routeTypeSchema,
  chatRequestSchema,
  chatResponseSchema,
} from "@/features/chat/api/chat.schemas";

export type RouteType = z.infer<typeof routeTypeSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;

export type MessageStatus = "pending" | "streaming" | "done" | "error";

export interface Step {
  label: string;
  state: "active" | "complete" | "error";
  detail?: string;
}

export interface Source {
  id: string;
  title: string;
  snippet?: string;
  url?: string;
}

/**
 * Opaque forward-compat carrier for the backend Phase-6 `component` SSE event.
 * Refined into a validated discriminated union by M10; nothing in M1/M2 reads a typed shape.
 */
export interface RichComponent {
  type: string;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** epoch milliseconds — serializable */
  timestamp: number;
  status: MessageStatus;
  steps: Step[];
  sources: Source[];
  route?: RouteType;
  /** Backend P6 `component` event payloads; empty on the blocking path; rendered by M10. */
  components?: RichComponent[];
  /** Legacy alias kept so the unmodified chat-message.tsx renders the chunk count in M1. */
  sourcesCount?: number;
  /** Stored on user messages so the retry function can re-send with the same web-search setting. */
  webSearchAllowed?: boolean;
  /**
   * Machine-readable backend error code (docs/09 §3), e.g. "free_tier_exhausted", captured
   * when a turn fails with a typed code. Set by the streaming strategy on the error path
   * (and surfaced on the blocking path) so M7's BYOK upsell CTA can key off it
   * (`errorCode === "free_tier_exhausted"`). Undefined on a generic error or a success.
   */
  errorCode?: string;
}
