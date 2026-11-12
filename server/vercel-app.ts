import express from "express";
import { parse as parseCookieHeader } from "cookie";
import * as cookieModule from "cookie";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import {
  CSRF_COOKIE_NAME,
  constantTimeStringEqual,
  newCsrfToken,
} from "./auth";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicPlatformScript } from "./_core/publicConfig";
import { createContext } from "./_core/context";
import { appRouter } from "./routers";
import {
  handleScheduledSync,
  ScheduledAuthError,
} from "./services/scheduled";

const serializeCookie = (cookieModule as any).serialize as (name: string, value: string, options?: unknown) => string;

type VercelRequestLike = {
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  [key: string]: any;
};

type VercelResponseLike = {
  statusCode: number;
  setHeader(name: string, value: string | string[]): void;
  getHeader(name: string): string | string[] | number | undefined;
  end(body?: string): void;
  [key: string]: any;
};

function adaptVercelRequest(req: VercelRequestLike) {
  if (!req.originalUrl) req.originalUrl = req.url ?? "/";
  if (!req.ip) {
    const forwarded = req.headers["x-forwarded-for"];
    req.ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress;
  }
  if (!req.get) req.get = (name: string) => {
    const value = req.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };
  return req;
}

function adaptVercelResponse(res: VercelResponseLike) {
  if (!res.locals) res.locals = {};
  if (!res.set) res.set = (field: string | Record<string, string>, value?: string) => {
    if (typeof field === "string" && value !== undefined) res.setHeader(field, value);
    else if (typeof field === "object") for (const [name, headerValue] of Object.entries(field)) res.setHeader(name, headerValue);
    return res;
  };
  if (!res.status) res.status = (code: number) => { res.statusCode = code; return res; };
  if (!res.type) res.type = (value: string) => { res.setHeader("Content-Type", `${value}; charset=utf-8`); return res; };
  if (!res.json) res.json = (body: unknown) => {
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
    return res;
  };
  if (!res.send) res.send = (body: unknown) => {
    if (typeof body === "object" && body !== null) return res.json(body);
    res.end(String(body ?? ""));
    return res;
  };
  const appendCookie = (value: string) => {
    const current = res.getHeader("Set-Cookie");
    const values = current ? (Array.isArray(current) ? current : [String(current)]) : [];
    res.setHeader("Set-Cookie", [...values, value]);
  };
  if (!res.cookie) res.cookie = (name: string, value: string, options: Record<string, unknown> = {}) => {
    appendCookie(serializeCookie(name, value, options));
    return res;
  };
  if (!res.clearCookie) res.clearCookie = (name: string, options: Record<string, unknown> = {}) => {
    appendCookie(serializeCookie(name, "", { ...options, expires: new Date(1), maxAge: 0 }));
    return res;
  };
  return res;
}

const app = express();
app.set("trust proxy", 1);
app.use((_req: any, res: any, next: any) => { res.set("Referrer-Policy", "no-referrer"); next(); });
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.get("/api/health", (_req: any, res: any) => res.json({ status: "ok" }));
app.post("/api/scheduled/sync", async (req: any, res: any) => {
  try {
    const result = await handleScheduledSync(req);
    res.set("Cache-Control", "no-store").status(200).json(result);
  } catch (error) {
    if (error instanceof ScheduledAuthError) { res.status(401).json({ error: "Scheduled task authentication failed." }); return; }
    console.error("Scheduled synchronization failed.");
    res.status(500).json({ error: "Scheduled synchronization failed." });
  }
});
app.get("/api/auth/csrf", (req: any, res: any) => {
  const token = newCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, { ...getSessionCookieOptions(req), httpOnly: false, maxAge: 60 * 60 * 1000 });
  res.set("Cache-Control", "no-store").json({ token });
});
app.get("/api/platform/config.js", (_req: any, res: any) => res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript()));
app.use("/api/trpc", (req: any, res: any, next: any) => {
  if (req.method !== "POST") return next();
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  if (!constantTimeStringEqual(cookies[CSRF_COOKIE_NAME], req.get("x-csrf-token"))) {
    res.status(403).json({ error: { message: "Validação de segurança expirada. Recarregue a página." } });
    return;
  }
  next();
});
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

export default app;

export function handleVercelRequest(req: VercelRequestLike, res: VercelResponseLike): void {
  app(adaptVercelRequest(req) as any, adaptVercelResponse(res) as any);
}
