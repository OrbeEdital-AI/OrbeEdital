import { describe, expect, it } from "vitest";
import { hashActionToken } from "./services/authActions";

describe("hashActionToken", () => {
  it("creates a deterministic SHA-256 hex digest without retaining the raw token", () => {
    const token = "random-opaque-token-value";
    const first = hashActionToken(token);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(hashActionToken(token)).toBe(first);
    expect(first).not.toContain(token);
  });

  it("changes when the token changes", () => {
    expect(hashActionToken("token-a")).not.toBe(hashActionToken("token-b"));
  });
});
