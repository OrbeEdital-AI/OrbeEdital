import { runRadarAutomatic } from "./orberadar-automatic";
import { jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import { eq, inArray } from "drizzle-orm";
import type { Request } from "express";
import { auditLogs, connectors } from "../../drizzle/schema";
import { getDb } from "../db";
import { syncConnector } from "./ingestion";
import { dispatchDeadlineNotifications } from "./deadlineNotifications";

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
  const request = req as unknown as { headers: { cookie?: string; authorization?: string } };
  const supabaseCronSecret = process.env.SUPABASE_CRON_SECRET?.trim();
  if (supabaseCronSecret && request.headers.authorization === `Bearer ${supabaseCronSecret}`) {
    return "supabase-cron:all-sources";
  }
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && request.headers.authorization === `Bearer ${cronSecret}`) {
    return "vercel-cron:compras.gov.br";
  }
  const token = parseCookieHeader(request.headers.cookie ?? "")[COOKIE_NAME];
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

async function syncScheduledSource(source: typeof connectors.$inferSelect) {
  if (source.code === "pncp") {
    const configuration = source.configuration && typeof source.configuration === "object"
      ? source.configuration
      : {};
    const configuredPage = Number(configuration.nextPncpPage ?? 1);
    const startPage = Number.isInteger(configuredPage) && configuredPage > 0 ? configuredPage : 1;
    // The public PNCP API can expose thousands of open opportunities. Process a
    // bounded window per 6-hour execution to stay below Vercel's 300s limit.
    const result = await syncConnector("pncp", {
      mode: "open",
      startPage,
      maxPages: 15,
      pageSize: 50,
    });
    const totalPages = result.reportedTotalPages ?? result.lastPage;
    const nextPncpPage = result.lastPage >= totalPages ? 1 : result.lastPage + 1;
    await getDb().update(connectors).set({
      configuration: { ...configuration, nextPncpPage },
      updatedAt: new Date(),
    }).where(eq(connectors.id, source.id));
    return { ...result, pageWindow: { startPage, endPage: result.lastPage, totalPages, nextPncpPage } };
  }
  return syncConnector("compras.gov.br", {
    daysBack: 7,
    modalityCodes: [3, 5, 8, 9, 11, 12, 14, 15, 20],
    allPages: true,
    pageSize: 500,
  });
}

export async function handleScheduledSync(req: Request) {
  const taskUid = await resolveScheduledTask(req);
  const enabledSources = await getDb()
    .select()
    .from(connectors)
    .where(inArray(connectors.code, [...CONNECTORS]));

  if (taskUid === "supabase-cron:all-sources") {
    const runs: Array<Record<string, unknown>> = [];
    // Explicit opt-in; keep the existing source schedule unaffected by default.
    if (process.env.ORBERADAR_AUTOCOLLECT === "true") {
      try { runs.push({ source: "amm-mt", ...await runRadarAutomatic() }); }
      catch { runs.push({ source: "amm-mt", status: "failed" }); }
    }
    if (process.env.ORBERADAR_AMM_MG_DISCOVERY === "true") {
      try { runs.push({ source: "amm-mg", ...await runRadarAutomatic("amm-mg") }); }
      catch (error) { runs.push({ source: "amm-mg", status: "failed", error: error instanceof Error ? error.message.slice(0, 180) : "Unknown error" }); }
    }
    for (const source of enabledSources.filter(item => item.enabled)) {
      try {
        const result = await syncScheduledSource(source);
        runs.push({ source: source.code, status: "completed", ...result });
        await getDb().insert(auditLogs).values({
          action: "source.schedule.completed",
          entityType: "connector",
          entityId: source.code,
          details: { status: "synchronized", runId: result.runId, fetched: result.fetched, inserted: result.inserted, updated: result.updated, durationMs: result.durationMs, scheduler: "supabase_cron" },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 240) : "Unknown error";
        runs.push({ source: source.code, status: "failed", error: message });
        await getDb().insert(auditLogs).values({
          action: "source.schedule.failed",
          entityType: "connector",
          entityId: source.code,
          details: { status: "failed", message, scheduler: "supabase_cron" },
        }).catch(() => undefined);
      }
    }
    const notificationSummary = await dispatchDeadlineNotifications().catch(() => ({
      scannedEvents: 0, createdReminders: 0, createdSummaries: 0, failed: true,
    }));
    return { status: "synchronized" as const, scheduler: "supabase_cron", runs, notifications: notificationSummary };
  }
  const matched = enabledSources.find(source => {
    const configuration =
      source.configuration && typeof source.configuration === "object"
        ? source.configuration
        : {};
    return source.enabled && (taskUid === "vercel-cron:compras.gov.br"
      ? source.code === "compras.gov.br"
      : configuration.scheduledTaskUid === taskUid);
  });
  if (!matched) {
    await getDb().insert(auditLogs).values({
      action: "source.schedule.unmatched",
      entityType: "scheduled_task",
      details: { callbackReceived: true, matched: false },
    });
    return { status: "no_source_registered_for_task" as const };
  }
  try {
    const result = await syncScheduledSource(matched);
    const notificationSummary = await dispatchDeadlineNotifications().catch(async error => {
      await getDb().insert(auditLogs).values({
        action: "notification.schedule.failed",
        entityType: "notification_job",
        details: { message: error instanceof Error ? error.message.slice(0, 240) : "Unknown error" },
      }).catch(() => undefined);
      return { scannedEvents: 0, createdReminders: 0, createdSummaries: 0, failed: true };
    });
    await getDb().insert(auditLogs).values({
      action: "source.schedule.completed",
      entityType: "connector",
      entityId: matched.code,
      details: {
        status: "synchronized",
        runId: result.runId,
        fetched: result.fetched,
        inserted: result.inserted,
        updated: result.updated,
        durationMs: result.durationMs,
        notifications: notificationSummary,
      },
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
  } catch (error) {
    await getDb().insert(auditLogs).values({
      action: "source.schedule.failed",
      entityType: "connector",
      entityId: matched.code,
      details: {
        status: "failed",
        message: error instanceof Error ? error.message.slice(0, 240) : "Unknown error",
      },
    }).catch(logError => console.error("[scheduled-audit] failed to persist callback error", logError instanceof Error ? logError.message : "unknown"));
    throw error;
  }
}