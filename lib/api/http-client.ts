import type { ZodType } from "zod";
import { env } from "@/lib/env";
import { flags } from "@/lib/flags";
import { ApiError } from "./api-error";
import { authStore } from "@/features/auth/store/auth.store";
import { authApi } from "@/features/auth/api/auth.api";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions<T> {
  method?: HttpMethod;
  body?: unknown;
  schema?: ZodType<T>;
  /**
   * When true AND `flags.auth` is on, attach `Authorization: Bearer <access>` and run the
   * single-flight 401→refresh→retry dance. Dormant when the flag is off (byte-for-byte the
   * pre-auth request — no Bearer, no refresh).
   */
  auth?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Skip the base-URL prepend and use `path` verbatim (for cross-origin auth endpoints). */
  absoluteUrl?: boolean;
  /** Internal: guards against a second refresh on the retried request (loop-free). */
  __retried?: boolean;
}

const BASE_URL = env.NEXT_PUBLIC_API_URL;

// ---- single-flight refresh -------------------------------------------------
// N concurrent 401s must share ONE /auth/refresh call (no stampede, no token-overwrite
// race). The first 401 starts the refresh; concurrent 401s await the same promise.
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight; // join the in-flight refresh

  const refreshToken = authStore.getRefreshToken();
  if (!refreshToken) {
    return Promise.reject(
      new ApiError({
        message: "No refresh token available.",
        status: 401,
        kind: "unauthorized",
      })
    );
  }

  refreshInFlight = authApi
    .refresh({ refresh_token: refreshToken })
    .then((pair) => {
      authStore.setTokens(pair); // persist the rotated pair
      return pair.access_token;
    })
    .finally(() => {
      refreshInFlight = null; // clear the gate whether it resolved or rejected
    });

  return refreshInFlight;
}

function redirectToLogin(): void {
  if (typeof window !== "undefined") {
    const next = encodeURIComponent(
      window.location.pathname + window.location.search
    );
    window.location.assign(`/login?next=${next}`);
  }
}

// Dormant-by-default auth interceptor seam — live only when flags.auth && auth.
async function applyAuth(
  headers: Headers,
  auth: boolean | undefined
): Promise<Headers> {
  if (flags.auth && auth) {
    const token = authStore.getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function request<T = void>(
  path: string,
  opts: RequestOptions<T> = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    schema,
    auth,
    signal,
    headers: extra,
    absoluteUrl,
  } = opts;

  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = new Headers(extra);
  if (!isForm && body !== undefined)
    headers.set("Content-Type", "application/json");
  await applyAuth(headers, auth);

  const url = absoluteUrl
    ? path
    : `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : isForm
            ? (body as FormData)
            : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError({
      message: e instanceof Error ? e.message : "Network request failed",
      status: 0,
      kind: "network",
      payload: e,
    });
  }

  // ---- 403: terminal. Refreshing can't change ownership — never retry. ----
  if (res.status === 403) {
    let detail: string | undefined;
    let payload: unknown;
    try {
      payload = await res.json();
      if (payload && typeof payload === "object" && "detail" in payload) {
        const d = (payload as { detail?: unknown }).detail;
        if (typeof d === "string") detail = d;
      }
    } catch {
      /* non-JSON body */
    }
    throw new ApiError({
      message: detail ?? "You do not have access to this resource.",
      status: 403,
      kind: "forbidden",
      detail,
      payload,
    });
  }

  // ---- 401: single-flight refresh-once-and-retry (only when auth is live). ----
  if (res.status === 401 && flags.auth && auth && !opts.__retried) {
    try {
      await refreshAccessToken();
    } catch {
      authStore.clear();
      redirectToLogin();
      throw new ApiError({
        message: "Session expired. Please sign in again.",
        status: 401,
        kind: "unauthorized",
      });
    }
    // Retry ONCE with the refreshed token; __retried prevents a second refresh.
    return request<T>(path, { ...opts, __retried: true });
  }

  if (!res.ok) {
    let detail: string | undefined;
    let payload: unknown;
    try {
      payload = await res.json();
      if (payload && typeof payload === "object" && "detail" in payload) {
        const d = (payload as { detail?: unknown }).detail;
        if (typeof d === "string") detail = d;
      }
    } catch {
      /* body wasn't JSON */
    }
    // A 401 that survived the refresh path (flag off, no auth, or retry re-401ed):
    // clear + redirect when auth is live, then surface as unauthorized.
    if (res.status === 401) {
      if (flags.auth && auth) {
        authStore.clear();
        redirectToLogin();
      }
      throw new ApiError({
        message: detail ?? "Session expired. Please sign in again.",
        status: 401,
        kind: "unauthorized",
        detail,
        payload,
      });
    }
    throw new ApiError({
      message: detail ?? `Backend error: ${res.status}`,
      status: res.status,
      kind: "http",
      detail,
      payload,
    });
  }

  if (res.status === 204 || !schema) return undefined as T;

  let json: unknown;
  try {
    json = await res.json();
  } catch (e) {
    throw new ApiError({
      message: "Response was not valid JSON",
      status: res.status,
      kind: "parse",
      payload: e,
    });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError({
      message: "Response failed schema validation",
      status: res.status,
      kind: "parse",
      detail: parsed.error.message,
      payload: json,
    });
  }
  return parsed.data;
}
