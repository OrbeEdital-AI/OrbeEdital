import { parse as parseCookieHeader } from "cookie";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { and, count, desc, eq, inArray, sum } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, connectors, syncRuns, users, opportunities, subscriptions, payments, plans, companies, companyMembers, companyProfiles, favorites } from "../drizzle/schema";
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  SESSION_TTL_MS,
  createCompanyAccount,
  createSession,
  findUserForLogin,
  getSessionToken,
  revokeSession,
  touchLastSignedIn,
  verifyPassword,
} from "./auth";
import {
  findAccountByEmail,
  issueEmailVerification,
  issuePasswordReset,
  resetPasswordAction,
  verifyEmailAction,
} from "./services/authActions";
import { getDb } from "./db";
import { adminUsersRouter } from "./adminUsersRouter";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, financeProcedure, publicProcedure, router, sourceOperatorProcedure, protectedProcedure } from "./_core/trpc";
import { syncConnector } from "./services/ingestion";
import { changeMercadoPagoPlan, createMercadoPagoCheckout } from "./services/mercadoPago";
import { ensureCanAddFavorite, ensureCanSaveSearch, getPlanUsageSummary, recordSearchUsage } from "./services/planLimits";
import {
  deleteSavedSearch,
  getDashboardSummary,
  getOpportunityDetail,
  listFavorites,
  listSavedSearches,
  saveSearch,
  searchOpportunities,
  toggleFavorite,
  ensureBuiltInConnectors,
} from "./services/opportunities";

const emailSchema = z.string().trim().email().max(320).transform(value => value.toLowerCase());
const registerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: emailSchema,
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  password: z.string().min(10).max(128),
  companyName: z.string().trim().min(2).max(240),
  cnpj: z.string().trim().max(18).optional().or(z.literal("")),
  state: z.string().trim().length(2).optional().or(z.literal("")),
  municipality: z.string().trim().max(160).optional().or(z.literal("")),
  segment: z.string().trim().max(200).optional().or(z.literal("")),
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
const stateCodes = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const opportunitySearchSchema = z.object({
  query: z.string().trim().max(160).optional(),
  states: z.array(z.enum(stateCodes as [string, ...string[]])).max(27).optional(),
  municipality: z.string().trim().max(160).optional(),
  modalities: z.array(z.string().max(100)).max(20).optional(),
  statuses: z.array(z.string().max(60)).max(20).optional(),
  source: z.enum(["pncp", "compras.gov.br"]).optional(),
  minValue: z.number().nonnegative().max(1_000_000_000_000).optional(),
  maxValue: z.number().nonnegative().max(1_000_000_000_000).optional(),
  publishedFrom: z.string().datetime().optional(),
  publishedTo: z.string().datetime().optional(),
  deadlineFrom: z.string().datetime().optional(),
  deadlineTo: z.string().datetime().optional(),
  onlyOpen: z.boolean().optional(),
  page: z.number().int().min(1).max(100_000).optional(),
  pageSize: z.number().int().min(25).max(25).optional(),
}).refine(value => value.minValue === undefined || value.maxValue === undefined || value.minValue <= value.maxValue, { message: "O valor mínimo não pode superar o máximo." });
const profileUpdateSchema = z.object({
  legalName: z.string().trim().min(2).max(240),
  cnpj: z.string().trim().max(18).optional().or(z.literal("")),
  state: z.string().trim().length(2).optional().or(z.literal("")),
  municipality: z.string().trim().max(160).optional().or(z.literal("")),
  primarySegment: z.string().trim().max(200).optional().or(z.literal("")),
  segments: z.array(z.string().trim().min(1).max(100)).max(20),
  products: z.array(z.string().trim().min(1).max(160)).max(100),
  services: z.array(z.string().trim().min(1).max(160)).max(100),
  keywords: z.array(z.string().trim().min(1).max(100)).max(100),
  servedStates: z.array(z.enum(stateCodes as [string, ...string[]])).max(27),
  servedMunicipalities: z.array(z.string().trim().min(1).max(160)).max(100),
  catmatCodes: z.array(z.string().trim().min(1).max(40)).max(200),
  catserCodes: z.array(z.string().trim().min(1).max(40)).max(200),
  minimumValue: z.number().nonnegative().max(1_000_000_000_000).nullable(),
  maximumValue: z.number().nonnegative().max(1_000_000_000_000).nullable(),
}).refine(value => value.minimumValue === null || value.maximumValue === null || value.minimumValue <= value.maximumValue, { message: "O valor mínimo não pode superar o máximo." });

function setAuthCookies(req: Request, res: Response, token: string) {
  const base = getSessionCookieOptions(req);
  const cookieResponse = res as unknown as {
    cookie(name: string, value: string, options?: Record<string, unknown>): void;
  };
  cookieResponse.cookie(AUTH_COOKIE_NAME, token, { ...base, maxAge: SESSION_TTL_MS });
  const request = req as unknown as { headers: { cookie?: string } };
  const csrf = parseCookieHeader(request.headers.cookie ?? "")[CSRF_COOKIE_NAME];
  if (csrf) cookieResponse.cookie(CSRF_COOKIE_NAME, csrf, { ...base, httpOnly: false, maxAge: SESSION_TTL_MS });
}

function translateAuthError(error: unknown): never {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "23505") throw new TRPCError({ code: "CONFLICT", message: "Este e-mail ou CNPJ já está cadastrado." });
  if (error instanceof Error && error.message.includes("senha deve ter")) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível concluir a operação. Tente novamente." });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    register: publicProcedure.input(registerSchema).mutation(async ({ input, ctx }) => {
      try {
        const user = await createCompanyAccount(input);
        const session = await createSession(user.id);
        setAuthCookies(ctx.req, ctx.res, session.token);
        const verificationEmailSent = await issueEmailVerification(user).catch(() => false);
        return { user, emailVerificationRequired: !user.emailVerifiedAt, verificationEmailSent };
      } catch (error) { translateAuthError(error); }
    }),
    login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
      const user = await findUserForLogin(input.email);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
      }
      try {
        await touchLastSignedIn(user.id);
        const { passwordHash: _passwordHash, ...safeUser } = user;
        const session = await createSession(user.id);
        setAuthCookies(ctx.req, ctx.res, session.token);
        return { user: safeUser, emailVerificationRequired: !user.emailVerifiedAt };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível iniciar sua sessão. Tente novamente." });
      }
    }),
    requestEmailVerification: publicProcedure
      .input(z.object({ email: emailSchema.optional() }))
      .mutation(async ({ input, ctx }) => {
        const user = ctx.user ?? (input.email ? await findAccountByEmail(input.email) : null);
        if (!user || user.emailVerifiedAt) return { accepted: true } as const;
        const sent = await issueEmailVerification(user).catch(() => false);
        return ctx.user ? { accepted: true, sent } as const : { accepted: true } as const;
      }),
    verifyEmail: publicProcedure
      .input(z.object({ token: z.string().min(40).max(50) }))
      .mutation(async ({ input }) => {
        if (!(await verifyEmailAction(input.token))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O link de confirmação é inválido ou expirou. Solicite um novo e-mail." });
        }
        return { verified: true } as const;
      }),
    requestPasswordReset: publicProcedure
      .input(z.object({ email: emailSchema }))
      .mutation(async ({ input }) => {
        const user = await findAccountByEmail(input.email);
        if (user) await issuePasswordReset(user).catch(() => false);
        return { accepted: true } as const;
      }),
    resetPassword: publicProcedure
      .input(z.object({ token: z.string().min(40).max(50), password: z.string().min(10).max(128) }))
      .mutation(async ({ input }) => {
        if (!(await resetPasswordAction(input.token, input.password))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O link de redefinição é inválido ou expirou. Solicite outro." });
        }
        return { reset: true } as const;
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await revokeSession(getSessionToken(ctx.req));
      const options = getSessionCookieOptions(ctx.req);
      (ctx.res as unknown as {
        clearCookie(name: string, options?: Record<string, unknown>): void;
      }).clearCookie(AUTH_COOKIE_NAME, { ...options, maxAge: 0 });
      return { success: true } as const;
    }),
  }),
  account: router({
    profile: protectedProcedure.query(async ({ ctx }) => {
      const [row] = await getDb().select({ company: companies, profile: companyProfiles, memberRole: companyMembers.memberRole })
        .from(companyMembers).innerJoin(companies, eq(companyMembers.companyId, companies.id))
        .leftJoin(companyProfiles, eq(companyProfiles.companyId, companies.id))
        .where(eq(companyMembers.userId, ctx.user.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Não há empresa vinculada a esta conta." });
      return { ...row.company, profile: row.profile, memberRole: row.memberRole };
    }),
    updateProfile: protectedProcedure.input(profileUpdateSchema).mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async tx => {
        const [membership] = await tx.select({ companyId: companyMembers.companyId }).from(companyMembers)
          .where(eq(companyMembers.userId, ctx.user.id)).limit(1);
        if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "Não há empresa vinculada a esta conta." });
        const cnpj = input.cnpj?.replace(/\D/g, "") || null;
        await tx.update(companies).set({ legalName: input.legalName, cnpj, state: input.state?.toUpperCase() || null, municipality: input.municipality || null, primarySegment: input.primarySegment || null, updatedAt: new Date() }).where(eq(companies.id, membership.companyId));
        const profileValues = { segments: input.segments, products: input.products, services: input.services, keywords: input.keywords, servedStates: input.servedStates, servedMunicipalities: input.servedMunicipalities, catmatCodes: input.catmatCodes, catserCodes: input.catserCodes, minimumValue: input.minimumValue === null ? null : String(input.minimumValue), maximumValue: input.maximumValue === null ? null : String(input.maximumValue), updatedAt: new Date() };
        await tx.insert(companyProfiles).values({ companyId: membership.companyId, ...profileValues }).onConflictDoUpdate({ target: companyProfiles.companyId, set: profileValues });
        return { saved: true };
      });
    }),
  }),
  dashboard: router({
    summary: protectedProcedure.query(({ ctx }) => getDashboardSummary(ctx.user)),
  }),
  opportunities: router({
    search: protectedProcedure.input(opportunitySearchSchema).query(({ input, ctx }) => searchOpportunities(input, ctx.user.id)),
    recordSearch: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role === "user") {
        try { await recordSearchUsage(ctx.user.id); }
        catch (error) {
          const message = error instanceof Error ? error.message : "Não foi possível validar o limite do plano.";
          throw new TRPCError({ code: message.includes("limite") ? "TOO_MANY_REQUESTS" : "FORBIDDEN", message });
        }
      }
      return { recorded: true };
    }),
    detail: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ input, ctx }) => {
      const result = await getOpportunityDetail(input.id, ctx.user.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "A oportunidade não foi encontrada." });
      return result;
    }),
  }),
  favorites: router({
    list: protectedProcedure.query(({ ctx }) => listFavorites(ctx.user.id)),
    toggle: protectedProcedure.input(z.object({ opportunityId: z.string().uuid() })).mutation(async ({ input, ctx }) => {
      const exists = await getDb().select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.id, input.opportunityId)).limit(1);
      if (!exists.length) throw new TRPCError({ code: "NOT_FOUND", message: "A oportunidade não foi encontrada." });
      if (ctx.user.role === "user") {
        const [alreadySaved] = await getDb().select({ id: favorites.id }).from(favorites)
          .where(and(eq(favorites.userId, ctx.user.id), eq(favorites.opportunityId, input.opportunityId))).limit(1);
        if (!alreadySaved) {
          try { await ensureCanAddFavorite(ctx.user.id); }
          catch (error) {
            throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Limite de favoritos atingido." });
          }
        }
      }
      return { favorited: await toggleFavorite(ctx.user.id, input.opportunityId) };
    }),
  }),
  billing: router({
    plans: protectedProcedure.query(async () => getDb().select({
      id: plans.id, code: plans.code, name: plans.name, description: plans.description,
      monthlyPriceCents: plans.monthlyPriceCents, annualPriceCents: plans.annualPriceCents,
      features: plans.features, limits: plans.limits,
    }).from(plans).where(and(eq(plans.active, true), inArray(plans.code, ["essencial", "profissional"])))),
    usage: protectedProcedure.query(({ ctx }) => getPlanUsageSummary(ctx.user.id)),
    changePlan: protectedProcedure.input(z.object({ planId: z.string().uuid() })).mutation(async ({ input, ctx }) => {
      try {
        return await changeMercadoPagoPlan(ctx.user.id, input.planId);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Não foi possível alterar o plano.",
        });
      }
    }),
    checkout: protectedProcedure.input(z.object({
      planId: z.string().uuid(),
      interval: z.enum(["monthly", "annual"]),
    })).mutation(async ({ input, ctx }) => {
      try {
        return await createMercadoPagoCheckout(ctx.user.id, input.planId, input.interval);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Não foi possível iniciar a assinatura.",
        });
      }
    }),
  }),
  savedSearches: router({
    list: protectedProcedure.query(({ ctx }) => listSavedSearches(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(100), criteria: z.record(z.string(), z.unknown()) })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "user") {
        try { await ensureCanSaveSearch(ctx.user.id); }
        catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Limite de pesquisas salvas atingido." }); }
      }
      return saveSearch(ctx.user.id, input.name, input.criteria);
    }),
    delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(({ input, ctx }) => deleteSavedSearch(ctx.user.id, input.id)),
  }),
  adminUsers: adminUsersRouter,
  admin: router({
    overview: sourceOperatorProcedure.query(async () => {
      await ensureBuiltInConnectors();
      const db = getDb();
      const [userCount, opportunityCount, sourceRows, activeSubscribers, canceledSubscriptions] = await Promise.all([
        db.select({ n: count() }).from(users),
        db.select({ n: count() }).from(opportunities),
        db.select().from(connectors),
        db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.status, "active")),
        db.select({ n: count() }).from(subscriptions).where(inArray(subscriptions.status, ["cancelled", "canceled"])),
      ]);
      return { users: userCount[0]?.n ?? 0, opportunities: opportunityCount[0]?.n ?? 0, sourceCount: sourceRows.length, sources: sourceRows, activeSubscribers: activeSubscribers[0]?.n ?? 0, canceledSubscriptions: canceledSubscriptions[0]?.n ?? 0 };
    }),
    sources: router({
      list: sourceOperatorProcedure.query(async () => {
        await ensureBuiltInConnectors();
        const db = getDb();
        const [sources, runs, scheduleEvents] = await Promise.all([
          db.select().from(connectors).orderBy(connectors.name),
          db.select({ run: syncRuns, sourceName: connectors.name }).from(syncRuns).innerJoin(connectors, eq(syncRuns.connectorId, connectors.id)).orderBy(desc(syncRuns.startedAt)).limit(50),
          db.select({
            action: auditLogs.action,
            entityId: auditLogs.entityId,
            details: auditLogs.details,
            createdAt: auditLogs.createdAt,
          }).from(auditLogs)
            .where(inArray(auditLogs.action, ["source.schedule.completed", "source.schedule.failed"]))
            .orderBy(desc(auditLogs.createdAt))
            .limit(50),
        ]);
        return { sources, runs, scheduleEvents };
      }),
      run: sourceOperatorProcedure.input(z.object({
        sourceCode: z.enum(["pncp", "compras.gov.br"]),
        daysBack: z.number().int().min(1).max(30).default(7),
        modalityCodes: z.array(z.number().int().min(1).max(15)).min(1).max(3).default([6]),
        maxPages: z.number().int().min(1).max(3).default(1),
      })).mutation(async ({ input, ctx }) => {
        const startedAt = new Date();
        try {
          const result = await syncConnector(input.sourceCode, input);
          await getDb().insert(auditLogs).values({
            actorUserId: ctx.user.id,
            action: "source.sync.completed",
            entityType: "connector",
            entityId: input.sourceCode,
            details: {
              daysBack: input.daysBack,
              modalityCodes: input.modalityCodes,
              maxPages: input.maxPages,
              inserted: result.inserted,
              updated: result.updated,
              durationMs: Date.now() - startedAt.getTime(),
            },
          }).catch(error => console.error("[admin-audit] source sync log failed", error instanceof Error ? error.message : "unknown"));
          return result;
        } catch (error) {
          await getDb().insert(auditLogs).values({
            actorUserId: ctx.user.id,
            action: "source.sync.failed",
            entityType: "connector",
            entityId: input.sourceCode,
            details: { durationMs: Date.now() - startedAt.getTime(), message: error instanceof Error ? error.message.slice(0, 300) : "Unknown error" },
          }).catch(logError => console.error("[admin-audit] source sync failure log failed", logError instanceof Error ? logError.message : "unknown"));
          throw error;
        }
      }),
      configure: sourceOperatorProcedure.input(z.object({
        code: z.enum(["pncp", "compras.gov.br"]),
        enabled: z.boolean().optional(),
        frequencySeconds: z.number().int().min(300).max(86_400).optional(),
      })).mutation(async ({ input, ctx }) => {
        await ensureBuiltInConnectors();
        const changes: { enabled?: boolean; frequencySeconds?: number; updatedAt: Date } = { updatedAt: new Date() };
        if (input.enabled !== undefined) changes.enabled = input.enabled;
        if (input.frequencySeconds !== undefined) changes.frequencySeconds = input.frequencySeconds;
        const [source] = await getDb().update(connectors).set(changes).where(eq(connectors.code, input.code)).returning();
        await getDb().insert(auditLogs).values({
          actorUserId: ctx.user.id,
          action: "source.configuration.updated",
          entityType: "connector",
          entityId: input.code,
          details: { enabled: input.enabled, frequencySeconds: input.frequencySeconds },
        }).catch(error => console.error("[admin-audit] source configuration log failed", error instanceof Error ? error.message : "unknown"));
        return source;
      }),
      setScheduledTask: sourceOperatorProcedure.input(z.object({ code: z.enum(["pncp", "compras.gov.br"]), taskUid: z.string().trim().max(200) })).mutation(async ({ input, ctx }) => {
        await ensureBuiltInConnectors();
        const [current] = await getDb().select().from(connectors).where(eq(connectors.code, input.code)).limit(1);
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Fonte não cadastrada." });
        const configuration = current.configuration && typeof current.configuration === "object" ? current.configuration : {};
        const nextConfiguration = { ...configuration };
        if (input.taskUid) nextConfiguration.scheduledTaskUid = input.taskUid;
        else delete nextConfiguration.scheduledTaskUid;
        const [updated] = await getDb().update(connectors).set({ configuration: nextConfiguration, updatedAt: new Date() }).where(eq(connectors.id, current.id)).returning();
        await getDb().insert(auditLogs).values({
          actorUserId: ctx.user.id,
          action: "source.schedule_binding.updated",
          entityType: "connector",
          entityId: input.code,
          details: { scheduledTaskConfigured: Boolean(input.taskUid) },
        }).catch(error => console.error("[admin-audit] schedule binding log failed", error instanceof Error ? error.message : "unknown"));
        return updated;
      }),
    }),
    recentRuns: sourceOperatorProcedure.query(() => getDb().select({ run: syncRuns, sourceName: connectors.name }).from(syncRuns).innerJoin(connectors, eq(syncRuns.connectorId, connectors.id)).orderBy(desc(syncRuns.startedAt)).limit(100)),
    finance: financeProcedure.query(async () => {
      const db = getDb();
      const [activeSubscriptions, canceledSubscriptions, overdueSubscriptions, activePlans, paymentGroups] = await Promise.all([
        db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.status, "active")),
        db.select({ n: count() }).from(subscriptions).where(inArray(subscriptions.status, ["cancelled", "canceled"])),
        db.select({ n: count() }).from(subscriptions).where(inArray(subscriptions.status, ["past_due", "expired", "inadimplente"])),
        db.select({ billingInterval: subscriptions.billingInterval, monthlyPriceCents: plans.monthlyPriceCents, annualPriceCents: plans.annualPriceCents })
          .from(subscriptions).innerJoin(plans, eq(subscriptions.planId, plans.id)).where(eq(subscriptions.status, "active")),
        db.select({ status: payments.status, amountCents: sum(payments.amountCents) }).from(payments).groupBy(payments.status),
      ]);
      const mrrCents = Math.round(activePlans.reduce((total, row) => total + (row.billingInterval === "annual" ? row.annualPriceCents / 12 : row.monthlyPriceCents), 0));
      const byStatus = Object.fromEntries(paymentGroups.map(row => [row.status, Number(row.amountCents ?? 0)]));
      return {
        configured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_WEBHOOK_SECRET),
        note: process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_WEBHOOK_SECRET ? "Mercado Pago configurado. Os valores abaixo refletem os registros recebidos e confirmados pelo webhook." : "Credenciais do Mercado Pago incompletas; os valores refletem somente registros persistidos.",
        activeSubscriptions: activeSubscriptions[0]?.n ?? 0,
        canceledSubscriptions: canceledSubscriptions[0]?.n ?? 0,
        overdueSubscriptions: overdueSubscriptions[0]?.n ?? 0,
        mrrCents,
        arrCents: mrrCents * 12,
        paymentsByStatus: byStatus,
        approvedRevenueCents: byStatus.approved ?? 0,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
