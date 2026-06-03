import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type {
  Message,
  Step,
  Source,
  RichComponent,
  MessageStatus,
  RouteType,
} from "@/types";

interface ChatState {
  messages: Message[];
  draft: string;
  webSearchAllowed: boolean;
  isLoading: boolean;
  isStreaming: boolean;

  addMessage: (msg: Message) => void;
  appendContent: (id: string, chunk: string) => void;
  pushStep: (id: string, step: Step) => void;
  setSources: (id: string, sources: Source[]) => void;
  /** Legacy: sets sourcesCount for the unmodified chat-message.tsx footer. Dropped in M3. */
  setSourcesCount: (id: string, count: number) => void;
  /** Append a backend P6 rich component. Dark in M1; rendered by M10. */
  addComponent: (id: string, component: RichComponent) => void;
  setStatus: (id: string, status: MessageStatus) => void;
  setRoute: (id: string, route: RouteType) => void;
  /** Record the backend error code (e.g. "free_tier_exhausted") on a failed turn. */
  setErrorCode: (id: string, code: string | undefined) => void;
  /** Flip status to "done" and optionally apply a partial patch (e.g. overwrite content with done.answer). */
  finalize: (id: string, patch?: Partial<Message>) => void;
  /** Returns the most-recent user message; used by the retry callback. */
  lastUserMessage: () => Message | undefined;

  setDraft: (draft: string) => void;
  setWebSearchAllowed: (v: boolean) => void;
  setLoading: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  reset: () => void;
}

export function createMessage(
  partial: {
    role: "user" | "assistant";
    content: string;
    id?: string;
    timestamp?: number;
  } & Partial<Omit<Message, "id" | "timestamp" | "role" | "content">>
): Message {
  const { id, timestamp, steps, sources, status, ...rest } = partial;
  return {
    id: id ?? uuidv4(),
    timestamp: timestamp ?? Date.now(),
    steps: steps ?? [],
    sources: sources ?? [],
    status: status ?? "pending",
    ...rest,
  };
}

const updateMessage = (
  messages: Message[],
  id: string,
  fn: (m: Message) => Message
): Message[] => messages.map((m) => (m.id === id ? fn(m) : m));

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  draft: "",
  webSearchAllowed: false,
  isLoading: false,
  isStreaming: false,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  appendContent: (id, chunk) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) => ({
        ...m,
        content: m.content + chunk,
      })),
    })),

  pushStep: (id, step) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) => {
        const existing = m.steps.findIndex((st) => st.label === step.label);
        const steps =
          existing >= 0
            ? m.steps.map((st, i) => (i === existing ? step : st))
            : [...m.steps, step];
        return { ...m, steps };
      }),
    })),

  setSources: (id, sources) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) => ({ ...m, sources })),
    })),

  setSourcesCount: (id, count) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) => ({
        ...m,
        sourcesCount: count,
      })),
    })),

  addComponent: (id, component) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) => ({
        ...m,
        components: [...(m.components ?? []), component],
      })),
    })),

  setStatus: (id, status) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) => ({ ...m, status })),
    })),

  setRoute: (id, route) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) => ({ ...m, route })),
    })),

  setErrorCode: (id, errorCode) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) => ({ ...m, errorCode })),
    })),

  finalize: (id, patch) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) => ({
        ...m,
        ...patch,
        status: "done" as MessageStatus,
      })),
    })),

  lastUserMessage: () =>
    [...get().messages].reverse().find((m) => m.role === "user"),

  setDraft: (draft) => set({ draft }),
  setWebSearchAllowed: (webSearchAllowed) => set({ webSearchAllowed }),
  setLoading: (isLoading) => set({ isLoading }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  reset: () => set({ messages: [], isLoading: false, isStreaming: false }),
}));
