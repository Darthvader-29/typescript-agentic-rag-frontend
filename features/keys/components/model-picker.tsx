"use client";

import { Check, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { flags } from "@/lib/flags";
import { useProviderStore } from "@/features/keys/store/provider.store";
import { PROVIDERS, modelLabel } from "@/features/keys/models";

/**
 * Per-conversation provider/model picker (M7), rendered next to the chat input. The
 * selection is OPTIONAL on /api/chat: "Auto" (no provider) lets the backend use its default
 * (free Gemini tier); picking a model sends `provider` + `model`. State lives in the
 * persisted provider store, so a reload keeps the choice.
 *
 * Renders nothing when BYOK is off (the chat input is byte-for-byte today's).
 */
export function ModelPicker() {
  const provider = useProviderStore((s) => s.provider);
  const model = useProviderStore((s) => s.model);
  const setProvider = useProviderStore((s) => s.setProvider);
  const clearSelection = useProviderStore((s) => s.clearSelection);

  if (!flags.byok) return null;

  const current =
    provider && model ? modelLabel(provider, model) : "Auto (free tier)";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 gap-1 rounded-full px-2 text-xs"
          aria-label="Select model"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="max-w-[10rem] truncate">{current}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onSelect={() => clearSelection()}>
          <span className="flex-1">Auto (free Gemini tier)</span>
          {!provider && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        {PROVIDERS.map((p) => (
          <div key={p.provider}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {p.label}
            </DropdownMenuLabel>
            {p.models.map((m) => {
              const selected = provider === p.provider && model === m.id;
              return (
                <DropdownMenuItem
                  key={m.id}
                  onSelect={() => setProvider(p.provider, m.id)}
                  className={cn(selected && "font-medium")}
                >
                  <span className="flex-1">{m.label}</span>
                  {selected && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
