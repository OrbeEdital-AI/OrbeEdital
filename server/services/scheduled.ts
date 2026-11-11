import { jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import { inArray } from "drizzle-orm";
import type { Request } from "express";
import { connectors } from "../../drizzle/schema";
import { getDb } from "../db";
import { syncConnector } from "./ingestion";

const COOKIE_NAME = "app_session_id";
const CONNECTORS = ["pncp", "compras.gov.br"] as const;

export class ScheduledAuthError extends Error {}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`Required platform setting is unavailable: ${name}`);
  return value;
}

async function resolveScheduledTask(req: Request): Promise<string> {
  const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  if (!token)
    throw new ScheduledAuthError("Scheduled task credential is missing.");
  const projectId = requiredEnvironment("MANUS_PROJECT_ID");
  const signingSecret = requiredEnvironment("MANUS_JWT_SECRET");
  const oauthApi = requiredEnvironment("MANUS_OAUTH_API_URL").replace(
    /\/+$/,
    ""
  );
  let verifiedOpenId = "";
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(signingSecret),
      { algorithms: ["HS256"], currentDate: new Date() }
    );
    if (
      payload.appId !== projectId ||
      typeof payload.openId !== "string" ||
      !payload.openId.startsWith("cron_") ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new ScheduledAuthError(
        "Scheduled task credential is not valid for this project."
      );
    }
    verifiedOpenId = payload.openId;
  } catch (error) {
    if (error instanceof ScheduledAuthError) throw error;
    throw new ScheduledAuthError(
      "Scheduled task credential is invalid or expired."
    );
  }

  const response = await fetch(
    `${oauthApi}/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jwt_token: token, project_id: projectId }),
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!response.ok)
    throw new Error("Platform could not resolve scheduled task identity.");
  const identity = (await response.json()) as {
    openId?: unknown;
    projectId?: unknown;
    taskUid?: unknown;
  };
  if (
    identity.projectId !== projectId ||
    identity.openId !== verifiedOpenId ||
    typeof identity.taskUid !== "string" ||
    !identity.taskUid.trim()
  ) {
    throw new ScheduledAuthError(
      "Platform scheduled task identity did not match the credential."
    );
  }
  return identity.taskUid;
}

export async function handleScheduledSync(req: Request) {
  const taskUid = await resolveScheduledTask(req);
  const enabledSources = await getDb()
    .select()
    .from(connectors)
    .where(inArray(connectors.code, [...CONNECTORS]));
  const matched = enabledSources.find(source => {
    const configuration =
      source.configuration && typeof source.configuration === "object"
        ? source.configuration
        : {};
    return source.enabled && configuration.scheduledTaskUid === taskUid;
  });
  if (!matched) return { status: "no_source_registered_for_task" as const };
  const result = matched.code === "pncp"
    ? await syncConnector("pncp", { mode: "open", allPages: true, pageSize: 50 })
    : await syncConnector("compras.gov.br", {
        daysBack: 7,
        modalityCodes: [3, 5, 8, 9, 11, 12, 14, 15, 20],
        allPages: true,
        pageSize: 500,
      });
  const coverage = matched.code === "pncp"
    ? { scope: "open_proposals_all_modalities", allPages: true }
    : {
        scope: "supplemental_recent_publications",
        windowDays: 7,
        modalityCodes: [3, 5, 8, 9, 11, 12, 14, 15, 20],
        allPages: true,
        historicalCoverage: false,
      };
  return { status: "synchronized" as const, coverage, ...result };
}
