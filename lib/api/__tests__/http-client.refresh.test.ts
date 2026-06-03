import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Auth must be LIVE for the interceptor to attach Bearer + run the refresh dance.
vi.mock("@/lib/flags", () => ({ flags: { auth: true, streaming: false } }));

import { request } from "@/lib/api/http-client";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { ApiError } from "@/lib/api/api-error";

type FetchArgs = [string, RequestInit];

/** A scriptable fetch: each entry returns a Response for a URL predicate, in order. */
function installFetch(
  script: Array<{
    match: (url: string, init: RequestInit) => boolean;
    respond: () => Response;
  }>
) {
  const calls: FetchArgs[] = [];
  const used = new Array(script.length).fill(false);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      for (let i = 0; i < script.length; i++) {
        if (!used[i] && script[i].match(url, init)) {
          used[i] = true;
          return script[i].respond();
        }
      }
      throw new Error(`unexpected fetch: ${url}`);
    })
  );
  return calls;
}

function json(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function authHeader(init: RequestInit): string | undefined {
  const h = new Headers(init.headers);
  return h.get("Authorization") ?? undefined;
}

function seedTokens(access: string, refresh: string) {
  useAuthStore.setState({
    accessToken: access,
    refreshToken: refresh,
    userId: null,
    email: null,
    isGuest: false,
    hasHydrated: true,
  });
}

const OK_BODY = { ok: true } as const;
const okSchema = z.unknown();

describe("http-client auth interceptor (flag on)", () => {
  beforeEach(() => {
    localStorage.clear();
    seedTokens("access-old", "refresh-1");
    // jsdom: window.location.assign isn't implemented — stub it to observe redirects.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { pathname: "/", search: "", assign: vi.fn() },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("attaches Bearer <access> on auth:true requests", async () => {
    const calls = installFetch([
      { match: (u) => u.endsWith("/chat"), respond: () => json(200, OK_BODY) },
    ]);
    await request("/chat", { method: "POST", auth: true, schema: okSchema });
    expect(authHeader(calls[0][1])).toBe("Bearer access-old");
  });

  it("401 → single-flight refresh → retry once with the NEW token → resolves 200", async () => {
    const calls = installFetch([
      {
        match: (u) => u.endsWith("/chat"),
        respond: () => json(401, { detail: "expired" }),
      },
      {
        match: (u) => u.endsWith("/auth/refresh"),
        respond: () =>
          json(200, { access_token: "access-new", refresh_token: "refresh-2" }),
      },
      { match: (u) => u.endsWith("/chat"), respond: () => json(200, OK_BODY) },
    ]);

    const result = await request("/chat", {
      method: "POST",
      auth: true,
      schema: okSchema,
    });

    expect(result).toEqual(OK_BODY);
    // exactly one refresh call
    expect(calls.filter(([u]) => u.endsWith("/auth/refresh"))).toHaveLength(1);
    // the retry carried the refreshed token
    const chatCalls = calls.filter(([u]) => u.endsWith("/chat"));
    expect(authHeader(chatCalls[1][1])).toBe("Bearer access-new");
    // store now holds the rotated pair
    expect(useAuthStore.getState().accessToken).toBe("access-new");
  });

  it("concurrent 401s share ONE refresh (single-flight), then all retry", async () => {
    let refreshCount = 0;
    installFetch([
      { match: (u) => u.endsWith("/a"), respond: () => json(401, {}) },
      { match: (u) => u.endsWith("/b"), respond: () => json(401, {}) },
      { match: (u) => u.endsWith("/c"), respond: () => json(401, {}) },
      {
        match: (u) => u.endsWith("/auth/refresh"),
        respond: () => {
          refreshCount++;
          return json(200, {
            access_token: "access-new",
            refresh_token: "refresh-2",
          });
        },
      },
      { match: (u) => u.endsWith("/a"), respond: () => json(200, OK_BODY) },
      { match: (u) => u.endsWith("/b"), respond: () => json(200, OK_BODY) },
      { match: (u) => u.endsWith("/c"), respond: () => json(200, OK_BODY) },
    ]);

    const [ra, rb, rc] = await Promise.all([
      request("/a", { auth: true, schema: okSchema }),
      request("/b", { auth: true, schema: okSchema }),
      request("/c", { auth: true, schema: okSchema }),
    ]);

    expect([ra, rb, rc]).toEqual([OK_BODY, OK_BODY, OK_BODY]);
    expect(refreshCount).toBe(1); // stampede prevented
  });

  it("refresh FAILS → clears the store, redirects to /login, throws unauthorized", async () => {
    installFetch([
      { match: (u) => u.endsWith("/chat"), respond: () => json(401, {}) },
      {
        match: (u) => u.endsWith("/auth/refresh"),
        respond: () => json(401, {}),
      },
    ]);

    await expect(
      request("/chat", { method: "POST", auth: true, schema: okSchema })
    ).rejects.toMatchObject({ kind: "unauthorized" });

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(
      (window.location.assign as ReturnType<typeof vi.fn>).mock.calls[0][0]
    ).toContain("/login");
  });

  it("retry that 401s again does NOT trigger a second refresh (loop-free)", async () => {
    let refreshCount = 0;
    installFetch([
      { match: (u) => u.endsWith("/chat"), respond: () => json(401, {}) },
      {
        match: (u) => u.endsWith("/auth/refresh"),
        respond: () => {
          refreshCount++;
          return json(200, {
            access_token: "access-new",
            refresh_token: "refresh-2",
          });
        },
      },
      // retry still 401s → must NOT refresh a second time
      { match: (u) => u.endsWith("/chat"), respond: () => json(401, {}) },
    ]);

    await expect(
      request("/chat", { method: "POST", auth: true, schema: okSchema })
    ).rejects.toMatchObject({ kind: "unauthorized" });
    expect(refreshCount).toBe(1);
    expect(useAuthStore.getState().accessToken).toBeNull(); // cleared
  });

  it("403 is terminal: typed forbidden, no refresh attempted", async () => {
    const calls = installFetch([
      {
        match: (u) => u.endsWith("/chat"),
        respond: () => json(403, { detail: "not yours" }),
      },
    ]);

    const err = await request("/chat", {
      method: "POST",
      auth: true,
      schema: okSchema,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).kind).toBe("forbidden");
    expect((err as ApiError).isForbidden).toBe(true);
    expect(calls.some(([u]) => u.endsWith("/auth/refresh"))).toBe(false);
  });

  it("no refresh token → 401 clears + redirects without calling /auth/refresh", async () => {
    seedTokens("access-old", "");
    const calls = installFetch([
      { match: (u) => u.endsWith("/chat"), respond: () => json(401, {}) },
    ]);
    await expect(
      request("/chat", { method: "POST", auth: true, schema: okSchema })
    ).rejects.toMatchObject({ kind: "unauthorized" });
    expect(calls.some(([u]) => u.endsWith("/auth/refresh"))).toBe(false);
  });
});
