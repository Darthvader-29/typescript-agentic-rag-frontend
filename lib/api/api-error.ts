/**
 * Discriminates failures so callers (and the auth interceptor) can branch.
 *  - unauthorized → 401, refresh exhausted / no token (triggers login redirect)
 *  - forbidden    → 403, cross-user ownership (terminal — never retried/refreshed)
 *  - http         → other non-2xx
 *  - network      → fetch threw (offline, DNS, CORS preflight)
 *  - parse        → response body failed Zod validation
 */
export type ApiErrorKind =
  | "unauthorized"
  | "forbidden"
  | "http"
  | "network"
  | "parse";

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly detail?: string;
  readonly payload?: unknown;

  constructor(args: {
    message: string;
    status: number;
    kind?: ApiErrorKind;
    detail?: string;
    payload?: unknown;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.kind = args.kind ?? "http";
    this.detail = args.detail;
    this.payload = args.payload;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  get userMessage(): string {
    return this.detail ?? this.message;
  }

  get isForbidden(): boolean {
    return this.kind === "forbidden";
  }

  get isUnauthorized(): boolean {
    return this.kind === "unauthorized";
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
