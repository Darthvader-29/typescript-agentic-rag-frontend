import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Flag OFF: the interceptor must be byte-for-byte today's request — no Bearer, no refresh.
vi.mock("@/lib/flags", () => ({ flags: { auth: false, streaming: false } }));

import { request } from "@/lib/api/http-client";
import { useAuthStore } from "@/features/auth/store/auth.store";

const okSchema = z.unknown();

describe("http-client interceptor — flag OFF parity", () => {
  beforeEach(() => {
    // Even with a token present, nothing should attach it when the flag is off.
    useAuthStore.setState({
      accessToken: "should-not-be-sent",
      refreshToken: "r",
      userId: null,
      email: null,
      isGuest: false,
      hasHydrated: true,
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("never attaches Authorization, even for auth:true, when flags.auth is off", async () => {
    let seenAuth: string | null = "unset";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        seenAuth = new Headers(init.headers).get("Authorization");
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as unknown as Response;
      })
    );

    await request("/chat", { method: "POST", auth: true, schema: okSchema });
    expect(seenAuth).toBeNull();
  });

  it("a 401 with the flag off surfaces as a plain unauthorized error (no refresh, no redirect)", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ detail: "nope" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      request("/chat", { method: "POST", auth: true, schema: okSchema })
    ).rejects.toMatchObject({ status: 401 });
    // exactly one call — no /auth/refresh follow-up
    expect(
      (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls
    ).toHaveLength(1);
  });
});
