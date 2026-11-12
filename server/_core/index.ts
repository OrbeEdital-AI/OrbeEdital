import "dotenv/config";
import express from "express";
import { parse as parseCookieHeader } from "cookie";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  constantTimeStringEqual,
  newCsrfToken,
} from "../auth";
import { getSessionCookieOptions } from "./cookies";
import { publicPlatformScript } from "./publicConfig";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleScheduledSync, ScheduledAuthError } from "../services/scheduled";

const authAttemptBuckets = new Map<string, { count: number; resetAt: number }>();
const AUTH_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_AUTH_BUCKETS = 5000;
const AUTH_PROCEDURE_LIMITS = new Map<string, number>([
  ["auth.login", 8],
  ["auth.register", 3],
  ["auth.requestEmailVerification", 3],
  ["auth.verifyEmail", 8],
  ["auth.requestPasswordReset", 3],
  ["auth.resetPassword", 5],
]);

function limitAuthenticationAttempts(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method !== "POST") return next();
  const requestPath = req.originalUrl.split("?")[0].replace(/^\/api\/trpc\//, "").replace(/^\/+/, "");
  const procedure = requestPath.split(",").find(name => AUTH_PROCEDURE_LIMITS.has(name));
  if (!procedure) return next();

  const now = Date.now();
  const key = `${req.ip || req.socket.remoteAddress || "unknown"}:${procedure}`;
  let bucket = authAttemptBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + AUTH_ATTEMPT_WINDOW_MS };
  const limit = AUTH_PROCEDURE_LIMITS.get(procedure) ?? 3;
  if (bucket.count >= limit) {
    res.set("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    res.set("Cache-Control", "no-store").status(429).json({ error: { message: "Muitas tentativas. Aguarde antes de tentar novamente." } });
    return;
  }
  bucket.count += 1;
  authAttemptBuckets.delete(key);
  authAttemptBuckets.set(key, bucket);
  while (authAttemptBuckets.size > MAX_AUTH_BUCKETS) {
    const oldest = authAttemptBuckets.keys().next().value;
    if (oldest === undefined) break;
    authAttemptBuckets.delete(oldest);
  }
  next();
}

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.set("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.post("/api/scheduled/sync", async (req, res) => {
    try {
      const result = await handleScheduledSync(req);
      res.set("Cache-Control", "no-store").status(200).json(result);
    } catch (error) {
      if (error instanceof ScheduledAuthError) {
        res.status(401).json({ error: "Scheduled task authentication failed." });
        return;
      }
      console.error("Scheduled synchronization failed.");
      res.status(500).json({ error: "Scheduled synchronization failed." });
    }
  });
  app.get("/api/auth/csrf", (req, res) => {
    const token = newCsrfToken();
    const options = getSessionCookieOptions(req);
    res.cookie(CSRF_COOKIE_NAME, token, { ...options, httpOnly: false, maxAge: 60 * 60 * 1000 });
    res.set("Cache-Control", "no-store").json({ token });
  });
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });

  app.use("/api/trpc", (req, res, next) => {
    if (req.method !== "POST") return next();
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const csrfCookie = cookies[CSRF_COOKIE_NAME];
    const csrfHeader = req.get("x-csrf-token");
    if (!constantTimeStringEqual(csrfCookie, csrfHeader)) {
      res.status(403).json({ error: { message: "Validação de segurança expirada. Recarregue a página." } });
      return;
    }
    next();
  });
  app.use("/api/trpc", limitAuthenticationAttempts);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}

async function startServer() {
  const app = createApp();
  const server = createServer(app);
  if (process.env.NODE_ENV === "development") await setupVite(app, server);
  else serveStatic(app);

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

if (process.env.VERCEL !== "1") {
  startServer().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
