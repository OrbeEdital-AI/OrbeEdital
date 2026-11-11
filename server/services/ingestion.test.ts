import { describe, expect, it } from "vitest";
import { comparableChanges } from "./ingestion.js";

describe("comparableChanges", () => {
  it("records changes to visible organization and geography fields", () => {
    const existing = { agencyName: "Órgão A", state: "PE", municipality: "Recife" } as never;
    const next = { agencyName: "Órgão A", state: "PB", municipality: "Recife" } as never;

    expect(comparableChanges(existing, next)).toEqual({
      previousValues: { state: "PE" },
      newValues: { state: "PB" },
    });
  });

  it("normalizes timestamps before comparing source update dates", () => {
    const existing = { lastSourceUpdateAt: new Date("2026-11-01T12:00:00.000Z") } as never;
    const next = { lastSourceUpdateAt: new Date("2026-11-02T12:00:00.000Z") } as never;

    expect(comparableChanges(existing, next)).toEqual({
      previousValues: { lastSourceUpdateAt: "2026-11-01T12:00:00.000Z" },
      newValues: { lastSourceUpdateAt: "2026-11-02T12:00:00.000Z" },
    });
  });

  it("does not count raw payload or last-synced refreshes as user-visible updates", () => {
    const existing = {
      title: "Mesmo título",
      rawData: { source: "compras", raw: { internalRevision: 1 } },
      lastSyncedAt: new Date("2026-11-01T12:00:00.000Z"),
    } as never;
    const next = {
      title: "Mesmo título",
      rawData: { source: "compras", raw: { internalRevision: 2 } },
      lastSyncedAt: new Date("2026-11-02T12:00:00.000Z"),
    } as never;

    expect(comparableChanges(existing, next)).toBeNull();
  });
});
