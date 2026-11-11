import { auditLogs } from "../../drizzle/schema";
import { getDb } from "../db";
import { getEmailProviderForAudit } from "./email";

export type TransactionalEmailKind = "verification" | "password_reset";
export type TransactionalEmailOutcome = "attempted" | "accepted" | "failed";

function safeDatabaseCode(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) return "unknown";
  const code = String((error as { code?: unknown }).code);
  return /^[A-Z0-9_]{1,32}$/.test(code) ? code : "unknown";
}

export async function recordTransactionalEmailEvent(input: {
  userId: string;
  kind: TransactionalEmailKind;
  outcome: TransactionalEmailOutcome;
  errorCode?: string;
}): Promise<boolean> {
  try {
    await getDb().insert(auditLogs).values({
      actorUserId: input.userId,
      action: `email.${input.outcome}`,
      entityType: "transactional_email",
      entityId: input.kind,
      details: {
        provider: getEmailProviderForAudit(),
        outcome: input.outcome,
        ...(input.errorCode ? { errorCode: input.errorCode } : {}),
      },
    });
    return true;
  } catch (error) {
    // Never log a recipient, message body, token, SMTP response, or credential.
    console.error("[email] could not persist delivery audit event", safeDatabaseCode(error));
    return false;
  }
}
