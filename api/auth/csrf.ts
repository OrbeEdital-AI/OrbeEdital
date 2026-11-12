import { randomBytes } from "node:crypto";

type CsrfResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

const CSRF_COOKIE_NAME = "licitahub_csrf";

export default function handler(_req: unknown, res: CsrfResponse): void {
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
