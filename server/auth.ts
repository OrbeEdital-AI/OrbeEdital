import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import { and, eq, gt } from "drizzle-orm";
import type { Request } from "express";
import {
  authSessions,
  companyMembers,
  companyProfiles,
  companies,
  users,
  type SafeUser,
} from "../drizzle/schema";
import { getDb, hashSessionToken } from "./db";

export const AUTH_COOKIE_NAME = "orbeedital_session";
export const CSRF_COOKIE_NAME = "orbeedital_csrf";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_BYTES = 64;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

function derivePasswordKey(
  password: string,
  salt: Buffer,
  length: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      length,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
      (error, key) => {
        if (error) reject(error);
        else resolve(key as Buffer);
      }
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10 || password.length > 128) {
    throw new Error("A senha deve ter entre 10 e 128 caracteres.");
  }
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt, SCRYPT_KEY_BYTES);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  encoded: string
): Promise<boolean> {
  try {
    const [algorithm, nText, rText, pText, saltText, keyText] =
      encoded.split("$");
    if (
      algorithm !== "scrypt" ||
      Number(nText) !== SCRYPT_N ||
      Number(rText) !== SCRYPT_R ||
      Number(pText) !== SCRYPT_P ||
      !saltText ||
      !keyText
    )
      return false;
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(keyText, "base64url");
    if (salt.length !== 16 || expected.length !== SCRYPT_KEY_BYTES)
      return false;
    const actual = await derivePasswordKey(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export type RegisterAccountInput = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  companyName: string;
  cnpj?: string;
  state?: string;
  municipality?: string;
  segment?: string;
};

export async function createCompanyAccount(
  input: RegisterAccountInput
): Promise<SafeUser> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const cnpj = input.cnpj?.replace(/\D/g, "") || null;
  const database = getDb();

  return database.transaction(async tx => {
    const [user] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        role: "user",
      })
      .returning();

    const [company] = await tx
      .insert(companies)
      .values({
        legalName: input.companyName.trim(),
        cnpj,
        state: input.state?.trim().toUpperCase() || null,
        municipality: input.municipality?.trim() || null,
        primarySegment: input.segment?.trim() || null,
      })
      .returning({ id: companies.id });

    await tx
      .insert(companyMembers)
      .values({ companyId: company.id, userId: user.id, memberRole: "owner" });
    await tx
      .insert(companyProfiles)
      .values({
        companyId: company.id,
        segments: input.segment?.trim() ? [input.segment.trim()] : [],
      });

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  });
}

export async function findUserForLogin(email: string) {
  try {
    const [user] = await getDb()
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    return user;
  } catch (error) {
    const details = error as { code?: unknown; name?: unknown; message?: unknown };
    console.error("[auth] PostgreSQL user lookup failed", {
      code: typeof details.code === "string" ? details.code : "UNCLASSIFIED",
      name: typeof details.name === "string" ? details.name : "Error",
      message: typeof details.message === "string" ? details.message : "Unknown database error",
    });
    throw error;
  }
}

export async function touchLastSignedIn(userId: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ lastSignedIn: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function createSession(
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getDb()
    .insert(authSessions)
    .values({ tokenHash: hashSessionToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await getDb()
    .delete(authSessions)
    .where(eq(authSessions.tokenHash, hashSessionToken(token)));
}

export function getSessionToken(req: Request): string | undefined {
  const request = req as unknown as { headers: { cookie?: string } };
  const cookies = parseCookieHeader(request.headers.cookie ?? "");
  return cookies[AUTH_COOKIE_NAME];
}

export async function getUserFromRequest(
  req: Request
): Promise<SafeUser | null> {
  const token = getSessionToken(req);
  if (!token) return null;
  const now = new Date();
  const rows = await getDb()
    .select({ user: users })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(
      and(
        eq(authSessions.tokenHash, hashSessionToken(token)),
        gt(authSessions.expiresAt, now)
      )
    )
    .limit(1);
  const user = rows[0]?.user;
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export function newCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function constantTimeStringEqual(
  a: string | undefined,
  b: string | undefined
): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
