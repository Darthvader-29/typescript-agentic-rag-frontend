// lib/sse/stream-chat.ts
import { env } from "@/lib/env";
import { flags } from "@/lib/flags";
import { authStore } from "@/features/auth/store/auth.store";
import { parseSSE } from "@/lib/sse/parser";
import {
  SseStatusSchema,
  SseTokenSchema,
  SseDoneSchema,
  SseErrorSchema,
  SseComponentSchema,
  type SseRoute,
  type SseStage,
  type SseComponent,
} from "@/features/chat/api/chat.schemas";

/**
 * Carries the backend's machine-readable error `code` (e.g. "free_tier_exhausted")
 * from BOTH delivery paths to the hook:
 *   - a pre-stream HTTP 4xx whose JSON body is `{detail, code}` (guard tripped before
 *     the stream opened), and
 *   - a terminal in-band `event: error` with `{detail, code}`.
 * The hook branches on `.code` (NOT the HTTP status, which is an API-layer detail) to
 * decide between a generic error and the free-tier BYOK upsell. (M7; M9 extends streaming-error.)
 */
export class StreamError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "StreamError";
    this.code = code;
  }
}

/** The POST body for /api/chat — identical to the blocking ChatRequest, plus optional
 * provider/model selection (M7). The optional fields are omitted when no provider is
 * chosen, so the request is byte-for-byte today's when the picker is untouched. */
export interface StreamChatPayload {
  message: string;
  session_id: string;
  web_search_allowed: boolean;
  provider?: string;
  model?: string;
}

export interface StreamChatHandlers {
  /** A status stage arrived (routing | retrieving | searching web | synthesizing). */
  onStatus?: (stage: SseStage) => void;
  /** A token chunk arrived; `text` is the raw chunk to append to the body. */
  onToken?: (text: string) => void;
  /** A whole rich-output component block arrived (09 `component` event). Stored by M9; rendered by M10. */
  onComponent?: (component: SseComponent) => void;
  /** The stream completed with the final answer + backend route (flat enum, legacy tolerated). */
  onDone?: (result: { answer: string; route: SseRoute | null }) => void;
  /**
   * A typed `error` event OR a transport/HTTP failure occurred. For a free-tier-exhausted
   * response (either delivery path) the Error is a `StreamError` whose `.code` is
   * "free_tier_exhausted"; the hook branches on that to show the BYOK CTA.
   */
  onError?: (error: Error) => void;
  /** AbortController.signal that powers the Stop button. */
  signal?: AbortSignal;
}

/**
 * Stream a chat turn over SSE. Resolves when the stream completes, errors, or is
 * aborted. Never throws for an aborted stream (clean Stop). All other failures
 * are reported via onError and then the promise resolves (the hook owns UI state).
 */
export async function streamChat(
  payload: StreamChatPayload,
  handlers: StreamChatHandlers
): Promise<void> {
  const { onStatus, onToken, onComponent, onDone, onError, signal } = handlers;

  // M6: attach Bearer for the streaming POST too (it bypasses http-client and does its own
  // fetch). Flag-gated — with auth OFF this header is never set (byte-for-byte today). The
  // SSE path can't run the 401→refresh→retry dance (no re-fetch of an open stream), so a
  // mid-stream 401 surfaces via onError; M9 owns any richer streaming-refresh handling.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (flags.auth) {
    const token = authStore.getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${env.NEXT_PUBLIC_API_URL}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) return; // aborted before headers — clean stop
    onError?.(toError(err));
    return;
  }

  if (!res.ok) {
    // Non-stream HTTP error (auth / rate-limit / free-tier guard raised BEFORE the
    // stream opened). Surface the machine-readable `code` off the JSON body so the hook
    // can branch on it (e.g. free_tier_exhausted → BYOK CTA) — NOT on res.status.
    let detail = `Backend error: ${res.status}`;
    let code: string | undefined;
    try {
      const body = await res.json();
      const parsed = SseErrorSchema.safeParse(body);
      if (parsed.success) {
        detail = parsed.data.detail;
        code = parsed.data.code;
      } else if (body?.detail) {
        detail = String(body.detail);
      }
    } catch {
      /* non-JSON error body */
    }
    onError?.(new StreamError(detail, code));
    return;
  }

  if (!res.body) {
    onError?.(new Error("Streaming response had no body."));
    return;
  }

  try {
    for await (const { event, data } of parseSSE(res.body)) {
      switch (event) {
        case "status": {
          const parsed = SseStatusSchema.safeParse(safeJson(data));
          if (parsed.success) onStatus?.(parsed.data.stage);
          break;
        }
        case "token": {
          const parsed = SseTokenSchema.safeParse(safeJson(data));
          if (parsed.success) onToken?.(parsed.data.text);
          break;
        }
        case "component": {
          // Loose-validate the catalog `type` only (M10 owns the strict per-type union).
          // Drop on failure — mirrors the backend "invalid component degrades to
          // prose-only, never 500"; an unparseable block must never break the stream.
          const parsed = SseComponentSchema.safeParse(safeJson(data));
          if (parsed.success) onComponent?.(parsed.data);
          break;
        }
        case "done": {
          const parsed = SseDoneSchema.safeParse(safeJson(data));
          if (parsed.success) {
            onDone?.({
              answer: parsed.data.answer,
              route: parsed.data.route ?? null,
            });
          }
          return; // typed completion terminates the stream
        }
        case "error": {
          // Terminal in-band error. Surface `detail` + the optional `code`
          // (free_tier_exhausted etc.) on a StreamError so the hook can branch.
          const parsed = SseErrorSchema.safeParse(safeJson(data));
          onError?.(
            parsed.success
              ? new StreamError(parsed.data.detail, parsed.data.code)
              : new StreamError("Stream error")
          );
          return; // backend closes the stream cleanly after an error event
        }
        default:
          // Unknown/"message" events are ignored (forward-compatible).
          break;
      }
    }
  } catch (err) {
    if (isAbortError(err)) return; // Stop pressed mid-stream — clean
    onError?.(toError(err));
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null; // safeParse will then fail closed; we never throw on bad JSON
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}
