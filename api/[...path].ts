import express from "express";
import { parse as parseCookieHeader } from "cookie";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import {
  CSRF_COOKIE_NAME,
  constantTimeStringEqual,
  newCsrfToken,
} from "../server/auth";
import { getSessionCookieOptions } from "../server/_core/cookies";
import { publicPlatformScript } from "../server/_core/publicConfig";
import { createContext } from "../server/_core/context";
import { appRouter } from "../server/routers";
import {
  handleScheduledSync,
  ScheduledAuthError,
} from "../server/services/scheduled";

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
  res.cookie(CSRF_COOKIE_NAME, token, {
    ...options,
    httpOnly: false,
    maxAge: 60 * 60 * 1000,
  });
  res.set("Cache-Control", "no-store").json({ token });
});

app.get("/api/platform/config.js", (_req, res) => {
  res
    .set("Cache-Control", "no-store")
    .type("application/javascript")
    .send(publicPlatformScript());
});

app.use("/api/trpc", (req, res, next) => {
  if (req.method !== "POST") return next();
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const csrfCookie = cookies[CSRF_COOKIE_NAME];
  const csrfHeader = req.get("x-csrf-token");
  if (!constantTimeStringEqual(csrfCookie, csrfHeader)) {
    res.status(403).json({
      error: {
        message: "Validação de segurança expirada. Recarregue a página.",
      },
    });
    return;
  }
  next();
});

app.use(
  "/api/trpc",
  createExpressMiddleware({ router: appRouter, createContext })
);

export default app;
