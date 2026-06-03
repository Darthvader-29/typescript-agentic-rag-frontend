"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowUp, Globe, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api } from "@/features/chat/api/chat.api";
import { ModelPicker } from "@/features/keys/components/model-picker";

interface ChatInputProps {
  isLoading: boolean;
  onSend: (message: string, webSearch: boolean) => void;
  onFileUploaded?: (fileName: string) => void;
}

export function ChatInput({
  isLoading,
  onSend,
  onFileUploaded,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input, webSearch);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await api.uploadFile(file);
      toast.success(`${file.name} uploaded`);
      onFileUploaded?.(file.name);
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="border-border bg-background border-t p-4">
      <div className="mx-auto max-w-4xl space-y-2">
        <div className="border-border bg-background focus-within:ring-ring relative flex items-end gap-1 rounded-2xl border p-1 shadow-sm focus-within:ring-1">
          <div className="flex items-center gap-1 pl-1">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
              accept=".pdf,.docx,.txt"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Upload document"
                  className="text-muted-foreground hover:text-foreground h-8 w-8 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isLoading}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload document</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Toggle web search"
                  aria-pressed={webSearch}
                  className={cn(
                    "h-8 w-8 rounded-full transition-colors motion-reduce:transition-none",
                    webSearch
                      ? "bg-primary/10 text-primary hover:bg-primary/15"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setWebSearch((v) => !v)}
                >
                  <Globe className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {webSearch ? "Web search enabled" : "Web search disabled"}
              </TooltipContent>
            </Tooltip>

            {/* BYOK provider/model picker — flag-gated; renders nothing when BYOK is off. */}
            <ModelPicker />
          </div>

          <TextareaAutosize
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything…"
            minRows={1}
            maxRows={8}
            disabled={isLoading}
            aria-label="Message"
            className="placeholder:text-muted-foreground flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm leading-6 outline-none disabled:opacity-50"
          />

          <Button
            type="button"
            size="icon-sm"
            aria-label="Send message"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="mr-1 mb-0.5 h-8 w-8 shrink-0 rounded-full"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-muted-foreground text-center text-[10px]">
          AI can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
