"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { m } from "framer-motion";
import { Bot, User } from "lucide-react";

import { Message } from "@/types";
import { cn } from "@/lib/utils";
import { messageVariants, reduceVariants, layoutSpring } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CodeBlock } from "@/features/chat/components/code-block";
import { RouteBadge } from "@/features/chat/components/route-badge";
import { ThinkingSteps } from "@/features/chat/components/thinking-steps";
import { SourcesPanel } from "@/features/chat/components/sources-panel";
import { MessageActions } from "@/features/chat/components/message-actions";
import { StreamingCaret } from "@/features/chat/components/streaming-caret";
import { ComponentBlock } from "@/features/chat/components/rich/component-block";
import { normalizeComponents } from "@/features/chat/components/rich/component.schemas";

// Module-scope stable map — ReactMarkdown does not rebuild its renderer tree
// on each streamed token (M9) or parent re-render.
const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? "");
    const isInline = !match;
    if (isInline) {
      return (
        <code
          className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-xs"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <CodeBlock
        language={match?.[1]}
        value={String(children).replace(/\n$/, "")}
      />
    );
  },
  a: ({ children, ...props }) => (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-2 hover:underline"
      {...props}
    >
      {children}
    </a>
  ),
  ul: ({ ...props }) => <ul className="list-disc space-y-1 pl-4" {...props} />,
  ol: ({ ...props }) => (
    <ol className="list-decimal space-y-1 pl-4" {...props} />
  ),
};

interface ChatMessageProps {
  message: Message;
}

function ChatMessageImpl({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const reduced = useReducedMotion();
  const isStreaming = message.status === "streaming";

  // M10: a P6 `citation` block is the precise provenance channel. If one is present, suppress the
  // generic synthesized sources panel for this message so provenance isn't shown twice (R7).
  // normalizeComponents drops invalid blocks (defense-in-depth over the backend's own drop, §2.5).
  const hasCitation = normalizeComponents(message.components).some(
    (c) => c.type === "citation"
  );

  return (
    <m.div
      // Exclude the streaming message from layout projection — its height changes every
      // token and animating that reflow is pure jank. Settled messages get layout.
      layout={isStreaming ? false : "position"}
      transition={{ layout: layoutSpring }}
      variants={reduceVariants(messageVariants, reduced)}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        "group flex w-full gap-4 rounded-xl p-5",
        isUser
          ? "bg-primary/5 flex-row-reverse"
          : "border-border bg-card border shadow-sm"
      )}
    >
      <Avatar className="border-border h-8 w-8 shrink-0 border">
        <AvatarFallback
          className={cn(
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "min-w-0 flex-1 space-y-2",
          isUser ? "text-right" : "text-left"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2",
            isUser ? "justify-end" : "justify-start"
          )}
        >
          <span className="text-foreground text-sm font-semibold">
            {isUser ? "You" : "RAG Assistant"}
          </span>
          {!isUser && message.route && <RouteBadge route={message.route} />}
        </div>

        {!isUser && message.steps && message.steps.length > 0 && (
          <ThinkingSteps steps={message.steps} />
        )}

        <div
          className={cn(
            "prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed break-words",
            isUser ? "text-foreground/90" : "text-muted-foreground"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && <StreamingCaret reduced={reduced} />}
            </>
          )}
        </div>

        {/* M10: rich component blocks, after the body. The flag is read INSIDE <ComponentBlock>
            (R9), so this always renders the RAW (opaque) message.components — flag-off pretty-prints
            them, flag-on validates+renders per spec. Invalid blocks drop inside the dispatcher. */}
        {!isUser && message.components && message.components.length > 0 && (
          <div className="space-y-1">
            {message.components.map((spec, i) => (
              <ComponentBlock key={i} spec={spec} index={i} />
            ))}
          </div>
        )}

        {/* Sources (M3) — suppressed when a P6 citation component already shows provenance (R7). */}
        {!isUser && !hasCitation && (
          <SourcesPanel
            sources={message.sources}
            count={message.sourcesCount}
          />
        )}

        {!isUser && message.status !== "streaming" && (
          <MessageActions content={message.content} />
        )}
      </div>
    </m.div>
  );
}

// Re-render only when this message's identity/content/status/steps/sources change.
export const ChatMessage = React.memo(ChatMessageImpl, (prev, next) => {
  const a = prev.message;
  const b = next.message;
  return (
    a.id === b.id &&
    a.content === b.content &&
    a.status === b.status &&
    a.route === b.route &&
    a.sourcesCount === b.sourcesCount &&
    a.steps === b.steps &&
    a.sources === b.sources &&
    // M10 (R8): addComponent appends a NEW array reference (immutable update), so a late-arriving
    // component block changes identity here and repaints. Without this it wouldn't render.
    a.components === b.components
  );
});
ChatMessage.displayName = "ChatMessage";
