"use client";

import { useState } from "react";
import { Check, KeyRound, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useApiKeys,
  useDeleteApiKey,
  useSaveApiKey,
} from "@/features/keys/hooks/use-api-keys";
import {
  SaveKeyRequestSchema,
  type KeyMeta,
  type Provider,
} from "@/features/keys/api/keys.schemas";
import { PROVIDERS } from "@/features/keys/models";

/**
 * One provider's key row: a secret input + Save (create/update) and Remove. "Configured"
 * state (and the last4 hint) is derived from the list query; the secret is never returned,
 * so saved keys render only their masked tail, and the input always starts empty.
 */
function ProviderKeyRow({
  provider,
  label,
  existing,
}: {
  provider: Provider;
  label: string;
  existing?: KeyMeta;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = useSaveApiKey();
  const remove = useDeleteApiKey();
  const exists = Boolean(existing);

  const onSave = () => {
    const parsed = SaveKeyRequestSchema.safeParse({
      provider,
      api_key: value.trim(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid key.");
      return;
    }
    setError(null);
    save.mutate({ ...parsed.data, exists }, { onSuccess: () => setValue("") });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="text-muted-foreground h-4 w-4" />
            {label}
          </CardTitle>
          {exists && (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" />
              {existing?.last4 ? `••••${existing.last4}` : "Configured"}
            </Badge>
          )}
        </div>
        <CardDescription>
          {exists
            ? "A key is stored. Enter a new value to replace it."
            : `Add your ${label} API key for private, unlimited use.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <Input
            type="password"
            autoComplete="off"
            placeholder={
              exists ? "Enter a new key to replace" : "Paste API key"
            }
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={`${label} API key`}
            aria-invalid={Boolean(error)}
          />
          <Button
            type="button"
            onClick={onSave}
            disabled={save.isPending || !value.trim()}
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : exists ? (
              "Replace"
            ) : (
              "Save"
            )}
          </Button>
          {exists && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Remove ${label} key`}
              onClick={() => remove.mutate(provider)}
              disabled={remove.isPending}
            >
              {remove.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="text-destructive h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The BYOK key manager: one row per provider (Gemini / OpenAI / Anthropic). Reads the
 * stored-key list once and hands each row its current metadata so it can render
 * create-vs-replace correctly. Surfaces a load error inline rather than throwing.
 */
export function ApiKeysForm() {
  const { keys, isLoading, isError } = useApiKeys();

  const byProvider = (provider: Provider): KeyMeta | undefined =>
    keys.find((k) => k.provider === provider);

  return (
    <div className="space-y-4">
      {isLoading && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your keys…
        </p>
      )}
      {isError && (
        <p role="alert" className="text-destructive text-sm">
          Could not load your stored keys. You can still add a new one below.
        </p>
      )}
      {PROVIDERS.map((p) => (
        <ProviderKeyRow
          key={p.provider}
          provider={p.provider}
          label={p.label}
          existing={byProvider(p.provider)}
        />
      ))}
    </div>
  );
}
