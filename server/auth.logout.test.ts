import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { AUTH_COOKIE_NAME } from "./auth";
import type { TrpcContext } from "./_core/context";

type CookieCall = { name: string; options: Record<string, unknown> };

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const now = new Date();
  const ctx: TrpcContext = {
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      email: "sample@example.com",
      name: "Sample User",
      phone: null,
      role: "user",
      emailVerifiedAt: null,
      lastSignedIn: now,
      createdAt: now,
      updatedAt: now,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the secure session cookie", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(await caller.auth.logout()).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(AUTH_COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: 0,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});
