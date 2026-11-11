import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import {
  authSessions,
  emailVerifications,
  passwordResetTokens,
  users,
  type SafeUser,
} from "../../drizzle/schema";
import { hashPassword } from "../auth";
import { getDb, hashSessionToken } from "../db";
import { EmailDeliveryError, sendPasswordResetEmail, sendVerificationEmail } from "./email";
import { recordTransactionalEmailEvent, type TransactionalEmailKind } from "./emailAudit";

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export function hashActionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newActionToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashActionToken(token) };
}

function deliveryFailureCode(error: unknown): string {
  return error instanceof EmailDeliveryError ? error.code : "unexpected";
}

function logDeliveryFailure(kind: TransactionalEmailKind, error: unknown) {
  const code = deliveryFailureCode(error);
  console.error(`[email] ${kind} message not delivered`, code);
}

async function recordEmailEvent(input: Parameters<typeof recordTransactionalEmailEvent>[0]): Promise<boolean> {
  const recorded = await recordTransactionalEmailEvent(input);
  if (!recorded) console.error(`[email] ${input.kind} ${input.outcome} audit event is not persistent`, "audit_unavailable");
  return recorded;
}

export async function issueEmailVerification(user: SafeUser): Promise<boolean> {
  if (user.emailVerifiedAt) return false;
  const db = getDb();
  const now = new Date();
  const [recent] = await db
    .select({ createdAt: emailVerifications.createdAt })
    .from(emailVerifications)
    .where(eq(emailVerifications.userId, user.id))
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1);
  if (recent && now.getTime() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) return false;

  const action = newActionToken();
  await db.transaction(async tx => {
    await tx.delete(emailVerifications).where(eq(emailVerifications.userId, user.id));
    await tx.insert(emailVerifications).values({
      userId: user.id,
      tokenHash: action.tokenHash,
      expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
    });
  });
  if (!(await recordEmailEvent({ userId: user.id, kind: "verification", outcome: "attempted" }))) {
    console.error("[email] verification message not sent because attempt audit is unavailable", "audit_unavailable");
    return false;
  }
  try {
    await sendVerificationEmail({ ...action, to: user.email, name: user.name });
    await recordEmailEvent({ userId: user.id, kind: "verification", outcome: "accepted" });
    return true;
  } catch (error) {
    logDeliveryFailure("verification", error);
    await recordEmailEvent({
      userId: user.id,
      kind: "verification",
      outcome: "failed",
      errorCode: deliveryFailureCode(error),
    });
    return false;
  }
}

export async function verifyEmailAction(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return false;
  const now = new Date();
  return getDb().transaction(async tx => {
    const [action] = await tx
      .delete(emailVerifications)
      .where(and(eq(emailVerifications.tokenHash, hashActionToken(token)), gt(emailVerifications.expiresAt, now)))
      .returning({ userId: emailVerifications.userId });
    if (!action) return false;
    await tx.update(users)
      .set({ emailVerifiedAt: now, updatedAt: now })
      .where(eq(users.id, action.userId));
    await tx.delete(emailVerifications).where(eq(emailVerifications.userId, action.userId));
    return true;
  });
}

export async function issuePasswordReset(user: SafeUser): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const [recent] = await db
    .select({ createdAt: passwordResetTokens.createdAt })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id))
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(1);
  if (recent && now.getTime() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) return false;

  const action = newActionToken();
  await db.transaction(async tx => {
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await tx.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: action.tokenHash,
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
    });
  });
  if (!(await recordEmailEvent({ userId: user.id, kind: "password_reset", outcome: "attempted" }))) {
    console.error("[email] password_reset message not sent because attempt audit is unavailable", "audit_unavailable");
    return false;
  }
  try {
    await sendPasswordResetEmail({ ...action, to: user.email, name: user.name });
    await recordEmailEvent({ userId: user.id, kind: "password_reset", outcome: "accepted" });
    return true;
  } catch (error) {
    logDeliveryFailure("password_reset", error);
    await recordEmailEvent({
      userId: user.id,
      kind: "password_reset",
      outcome: "failed",
      errorCode: deliveryFailureCode(error),
    });
    return false;
  }
}

export async function resetPasswordAction(token: string, password: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return false;
  const passwordHash = await hashPassword(password);
  const now = new Date();
  return getDb().transaction(async tx => {
    const [action] = await tx
      .delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.tokenHash, hashActionToken(token)), gt(passwordResetTokens.expiresAt, now)))
      .returning({ userId: passwordResetTokens.userId });
    if (!action) return false;
    await tx.update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, action.userId));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, action.userId));
    await tx.delete(authSessions).where(eq(authSessions.userId, action.userId));
    return true;
  });
}

export async function findAccountByEmail(email: string): Promise<SafeUser | null> {
  const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
