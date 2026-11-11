import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auditMocks = vi.hoisted(() => ({
  insert: vi.fn(),
  values: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: vi.fn(() => ({ insert: auditMocks.insert })),
}));

import { recordTransactionalEmailEvent } from "./emailAudit";

const event = {
  userId: "00000000-0000-4000-8000-000000000001",
  kind: "verification" as const,
  outcome: "attempted" as const,
};

describe("transactional email audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditMocks.insert.mockReturnValue({ values: auditMocks.values });
    auditMocks.values.mockResolvedValue(undefined);
    vi.stubEnv("LICITAHUB_EMAIL_PROVIDER", "smtp");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports when the event was persisted", async () => {
    await expect(recordTransactionalEmailEvent(event)).resolves.toBe(true);
    expect(auditMocks.values).toHaveBeenCalledOnce();
  });

  it("reports an audit database failure without throwing or logging message data", async () => {
    auditMocks.values.mockRejectedValueOnce(Object.assign(new Error("private database details"), { code: "08006" }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(recordTransactionalEmailEvent(event)).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith("[email] could not persist delivery audit event", "08006");
    expect(log.mock.calls.flat().join(" ")).not.toContain("private database details");
    log.mockRestore();
  });
});
