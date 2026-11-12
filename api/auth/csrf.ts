import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";

const CSRF_COOKIE_NAME = "licitahub_csrf";

export default function handler(_req: Request, res: Response): void {
  const token = randomBytes(32).toString("hex");

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Set-Cookie",
    `${CSRF_COOKIE_NAME}=${token}; Path=/; Max-Age=3600; SameSite=None; Secure`
  );
  res.statusCode = 200;
  res.end(JSON.stringify({ token }));
}
