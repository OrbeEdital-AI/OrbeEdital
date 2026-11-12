import { describe, expect, it } from "vitest";
import {
  brazilDateParts,
  brazilDayBounds,
  brazilGreeting,
} from "./opportunities";

describe("dashboard date rules", () => {
  it("uses the Brasília timezone for the greeting", () => {
    expect(brazilGreeting(new Date("2026-11-12T11:00:00.000Z"))).toBe(
      "Bom dia"
    );
    expect(brazilGreeting(new Date("2026-11-12T15:00:00.000Z"))).toBe(
      "Boa tarde"
    );
    expect(brazilGreeting(new Date("2026-11-12T22:00:00.000Z"))).toBe(
      "Boa noite"
    );
  });

  it("keeps the day boundaries in America/Sao_Paulo", () => {
    const value = new Date("2026-11-12T02:30:00.000Z");
    expect(brazilDateParts(value)).toEqual({ year: 2026, month: 11, day: 11 });
    const bounds = brazilDayBounds(value);
    expect(bounds.start.toISOString()).toBe("2026-11-11T03:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-11-12T03:00:00.000Z");
  });
});
