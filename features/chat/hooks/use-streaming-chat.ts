"use client";

import { useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

import { useChatStore } from "@/features/chat/store/chat.store";
import { getSessionId } from "@/features/chat/api/chat.api";
import { streamChat, StreamError } from "@/lib/sse/stream-chat";
import { getChatModelSelection } from "@/features/keys/store/provider.store";
import {
  FREE_TIER_EXHAUSTED,
  type SseRoute,
  type SseComponent,
} from "@/features/chat/api/chat.schemas";
import type { RouteType, Source } from "@/types";

/**
 * Map the backend `done.route` to the frontend RouteType union so a streamed Message
 * is shape-identical to a blocking one. Authoritative form is the FLAT enum from 09
 * Appendix A (`RAG | WEB | BOTH | DIRECT`): `BOTH`→"WEB+RAG"; `RAG`/`WEB`/`DIRECT`
 * pass through. The legacy 07 `{destination, relevant}` object is tolerated defensively
 * (reconciled in M9).
 */
function mapRoute(route: SseRoute | null): RouteType {
  if (!route) return "DIRECT";
  // Legacy object form (07): map by destination.
  if (typeof route === "object") {
    return route.destination === "web_search" ? "WEB" : "RAG";
  }
  // Flat enum (09, authoritative).
  if (route === "BOTH") return "WEB+RAG";
  return route; // "RAG" | "WEB" | "DIRECT" are valid RouteType members
}

/**
 * The `citation` component is the SOURCES / provenance channel (09 §5):
 *   { type: "citation", items: [{ label, source_id, snippet }] }
 * Flatten the items of every collected citation component into the Message `sources`
 * shape the sources panel renders. Read tolerantly — the component schema validates only
 * the catalog `type` (M9), so each item is `unknown` until M10's strict per-type schema.
 * Malformed/absent items contribute nothing rather than throwing.
 */
function citationsToSources(citations: SseComponent[]): Source[] {
  const sources: Source[] = [];
  for (const c of citations) {
    const items = (c as { items?: unknown }).items;
    if (!Array.isArray(items)) continue;
    for (const raw of items) {
      if (typeof raw !== "object" || raw === null) continue;
      const item = raw as {
        label?: unknown;
        source_id?: unknown;
        snippet?: unknown;
        url?: unknown;
      };
      const title =
        typeof item.label === "string" && item.label.length > 0
          ? item.label
          : typeof item.source_id === "string"
            ? item.source_id
            : "Source";
      sources.push({
        id:
          typeof item.source_id === "string"
            ? item.source_id
            : `citation-${sources.length}`,
        title,
        snippet: typeof item.snippet === "string" ? item.snippet : undefined,
        url: typeof item.url === "string" ? item.url : undefined,
      });
    }
  }
  return sources;
}

export function useStreamingChat() {
  const addMessage = useChatStore((s) => s.addMessage);
  const appendContent = useChatStore((s) => s.appendContent);
  const pushStep = useChatStore((s) => s.pushStep);
  const addComponent = useChatStore((s) => s.addComponent);
  const setSources = useChatStore((s) => s.setSources);
  const setRoute = useChatStore((s) => s.setRoute);
  const finalize = useChatStore((s) => s.finalize);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const isStreaming = useChatStore((s) => s.isStreaming);

  // One in-flight stream at a time; the controller powers the Stop button.
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string, webSearchAllowed: boolean) => {
      // 1) user message
      addMessage({
        id: uuidv4(),
        role: "user",
        content: text,
        status: "done",
        steps: [],
        sources: [],
        timestamp: Date.now(),
        webSearchAllowed,
      });

      // 2) empty assistant message we stream INTO
      const assistantId = uuidv4();
      addMessage({
        id: assistantId,
        role: "assistant",
        content: "",
        steps: [],
        sources: [],
        status: "streaming",
        timestamp: Date.now(),
      });

      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);

      // The `citation` components are the SOURCES channel (09 §5). Collect them across
      // the stream and flush to the sources panel on `done` — no status-derived guess.
      const citations: SseComponent[] = [];

      await streamChat(
        {
          message: text,
          session_id: getSessionId(),
          web_search_allowed: webSearchAllowed,
          // M7: optional per-conversation provider/model. Spreads to nothing when no
          // provider is selected ⇒ the backend default (free Gemini tier).
          ...getChatModelSelection(),
        },
        {
          signal: controller.signal,
          onStatus: (stage) => {
            // status stage → a live thinking step (feeds ThinkingSteps panel)
            pushStep(assistantId, { label: stage, state: "active" });
          },
          onToken: (chunk) => {
            // token chunk → append to the streaming body (+ M4 caret rides this)
            appendContent(assistantId, chunk);
          },
          onComponent: (component) => {
            // Store every whole rich block on message.components (M9 sink; M10 renders).
            addComponent(assistantId, component);
            // A citation block is provenance → collect it for the sources panel.
            if (component.type === "citation") citations.push(component);
          },
          onDone: ({ answer, route }) => {
            // Canonical final body is done.answer (== concatenated tokens).
            setRoute(assistantId, mapRoute(route));
            // Sources come ONLY from citation components; none → leave [] (no fabricated count).
            const sources = citationsToSources(citations);
            if (sources.length > 0) setSources(assistantId, sources);
            finalize(assistantId, { content: answer });
          },
          onError: (error) => {
            pushStep(assistantId, { label: "error", state: "error" });
            setRoute(assistantId, "ERROR");
            // Branch on the machine-readable CODE (docs/09 §3), not the HTTP status. A
            // free-tier-exhausted code (from either delivery path) is captured on the
            // message so M7's BYOK "add your own key" CTA can key off `errorCode`.
            const code = error instanceof StreamError ? error.code : undefined;
            finalize(assistantId, {
              errorCode: code,
              content:
                code === FREE_TIER_EXHAUSTED
                  ? error.message ||
                    "You've used up the free Gemini tier. Add your own API key to continue."
                  : error.message ||
                    "The AI service returned an error. Please try again later.",
            });
          },
        }
      );

      abortRef.current = null;
      setStreaming(false);
    },
    [
      addMessage,
      appendContent,
      pushStep,
      addComponent,
      setSources,
      setRoute,
      finalize,
      setStreaming,
    ]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort(); // AbortError → streamChat resolves cleanly
    abortRef.current = null;
    setStreaming(false);
  }, [setStreaming]);

  return { sendMessage, stop, isStreaming };
}
