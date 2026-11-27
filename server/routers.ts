import { probeCandidateSource } from "./connectors/candidate-sources";
import { probeTcePe } from "./connectors/tce-pe";
import { probeSergipe } from "./connectors/sergipe";
import { runRadarAutomatic } from "./services/orberadar-automatic";
import { listRadarReview, setRadarReview, verifyRadarCandidate } from "./services/orberadar-review";
import { persistRadarRun } from "./services/orberadar-staging";
import { compareRadarNotices } from "./services/orberadar-compare";
import { runAmmMgPilot, runAmmMtPilot } from "./connectors/orberadar-fetch";
import { parse as parseCookieHeader } from "cookie";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { and, count, desc, eq, gte, inArray, isNotNull, lt, or, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, connectors, syncRuns, users, opportunities, subscriptions, payments, plans, companies, companyMembers, companyProfiles, favorites, notifications, globalSettings } from "../drizzle/schema";
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
import { supportRouter } from "./supportRouter";
import { orbeAiRouter } from "./orbeAiRouter";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, authenticatedProcedure, financeProcedure, publicProcedure, router, sourceOperatorProcedure, protectedProcedure, superadminProcedure } from "./_core/trpc";
import { syncConnector } from "./services/ingestion";
import { analyzeOpportunityEdital } from "./services/editalAnalysis";
import { cancelMercadoPagoSubscription, changeMercadoPagoPlan, createMercadoPagoCheckout, createMercadoPagoPix, getMercadoPagoPixStatus, refundMercadoPagoPayment, reconcileExternallyRefundedPayment, verifyMercadoPagoPayments } from "./services/mercadoPago";
import { ensureCanAddFavorite, ensureCanSaveSearch, getPlanUsageSummary, getSubscriptionAccess, recordSearchUsage } from "./services/planLimits";
import {
  deleteSavedSearch,
  getDashboardSummary,
  getFavoriteChanges,
  getRecommendedOpportunities,
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
  createdFrom: z.string().datetime().optional(),
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
  servedStates: z.preprocess(value => {
    if (!Array.isArray(value)) return value;
    const entries = value.map(item => typeof item === "string" ? item.trim().toUpperCase() : item);
    if (entries.some(item => typeof item === "string" && /^(TODOS?|TODAS?|TODO O BRASIL|BRASIL INTEIRO)$/.test(item))) return [...stateCodes];
    return entries;
  }, z.array(z.enum(stateCodes as [string, ...string[]])).max(27)),
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
  support: supportRouter,
  orbeAi: orbeAiRouter,
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
      if (user.suspendedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta está suspensa. Entre em contato com o suporte do OrbeEdital." });
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
    favoriteChanges: protectedProcedure.query(({ ctx }) => getFavoriteChanges(ctx.user.id)),
    recommendations: protectedProcedure.query(({ ctx }) => getRecommendedOpportunities(ctx.user.id)),
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
    analyzeEdital: protectedProcedure
      .input(z.object({ id: z.string().uuid(), force: z.boolean().optional() }))
      .mutation(({ input, ctx }) => analyzeOpportunityEdital(input.id, ctx.user.id, input.force ?? false)),
  }),
  agenda: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const now = new Date();
      const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const db = getDb();
      const rows = await db.select({
        opportunity: opportunities,
        sourceName: connectors.name,
      }).from(favorites)
        .innerJoin(opportunities, eq(favorites.opportunityId, opportunities.id))
        .innerJoin(connectors, eq(opportunities.connectorId, connectors.id))
        .where(and(
          eq(favorites.userId, ctx.user.id),
          or(
            and(gte(opportunities.proposalDeadline, now), lt(opportunities.proposalDeadline, horizon)),
            and(gte(opportunities.openingDate, now), lt(opportunities.openingDate, horizon)),
            and(gte(opportunities.sessionAt, now), lt(opportunities.sessionAt, horizon)),
          ),
        ))
        .orderBy(opportunities.proposalDeadline);
      return rows.map(row => ({
        ...row.opportunity,
        sourceName: row.sourceName,
        href: `/app/opportunities/${row.opportunity.id}`,
      }));
    }),
  }),
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = getDb();
      const rows = await db.select().from(notifications)
        .where(eq(notifications.userId, ctx.user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(100);
      return {
        items: rows,
        unread: rows.filter(item => !item.readAt).length,
      };
    }),
    markRead: protectedProcedure.input(z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = getDb();
        if (input.all) {
          await db.update(notifications).set({ readAt: new Date() })
            .where(and(eq(notifications.userId, ctx.user.id), isNotNull(notifications.id)));
        } else if (input.id) {
          await db.update(notifications).set({ readAt: new Date() })
            .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.id, input.id)));
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Informe uma notificação ou solicite marcar todas como lidas." });
        }
        return { updated: true };
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
    plans: publicProcedure.query(async () => getDb().select({
      id: plans.id, code: plans.code, name: plans.name, description: plans.description,
      monthlyPriceCents: plans.monthlyPriceCents, annualPriceCents: plans.annualPriceCents,
      features: plans.features, limits: plans.limits,
    }).from(plans).where(and(eq(plans.active, true), inArray(plans.code, ["essencial", "profissional", "teste-gratis"])))),
    access: authenticatedProcedure.query(({ ctx }) => getSubscriptionAccess(ctx.user.id)),
    usage: authenticatedProcedure.query(({ ctx }) => getPlanUsageSummary(ctx.user.id)),
    resumePlan: authenticatedProcedure.query(async ({ ctx }) => {
      const db = getDb();
      const [membership] = await db.select({ companyId: companyMembers.companyId })
        .from(companyMembers).where(eq(companyMembers.userId, ctx.user.id)).limit(1);
      if (!membership) return null;
      const attempts = await db.select({
        id: subscriptions.id,
        code: plans.code,
        status: subscriptions.status,
        provider: subscriptions.provider,
        providerSubscriptionId: subscriptions.providerSubscriptionId,
      }).from(subscriptions).innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(eq(subscriptions.companyId, membership.companyId))
        .orderBy(desc(subscriptions.createdAt)).limit(10);
      const latest = attempts[0];
      const priorTestAttempt = attempts.find(item => item.code === "teste-gratis" && item.status === "failed");
      if (latest?.code === "essencial" && latest.status === "pending" &&
          latest.provider === "mercadopago" && latest.providerSubscriptionId && priorTestAttempt) {
        await cancelMercadoPagoSubscription(latest.id);
        return "teste-gratis";
      }
      // Cancelled subscriptions must not override the last plan the user actually attempted.
      const resumableAttempt = attempts.find(item => item.status !== "cancelled");
      return resumableAttempt?.code ?? null;
    }),
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
    checkout: authenticatedProcedure.input(z.object({
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
    pixCheckout: authenticatedProcedure.input(z.object({
      planId: z.string().uuid(),
      interval: z.enum(["monthly", "annual"]).default("monthly"),
      document: z.string().trim().max(18).optional(),
    })).mutation(async ({ input, ctx }) => {
      try {
        return await createMercadoPagoPix(ctx.user.id, input.planId, input.interval, input.document);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Não foi possível gerar o Pix.",
        });
      }
    }),
    verifyPayment: authenticatedProcedure.mutation(async ({ ctx }) => {
      try {
        return await verifyMercadoPagoPayments(ctx.user.id);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: error instanceof Error ? error.message : "Não foi possível consultar o Mercado Pago.",
        });
      }
    }),
    pixStatus: authenticatedProcedure.input(z.object({
      paymentId: z.string().trim().min(1).max(80),
    })).query(async ({ input, ctx }) => {
      try {
        return await getMercadoPagoPixStatus(ctx.user.id, input.paymentId);
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : "Cobrança Pix não encontrada.",
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
      const query = typeof input.criteria.query === "string" ? input.criteria.query.trim() : "";
      return saveSearch(ctx.user.id, input.name, { ...input.criteria, query: query || input.name });
    }),
    delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(({ input, ctx }) => deleteSavedSearch(ctx.user.id, input.id)),
  }),
  adminUsers: adminUsersRouter,
  admin: router({
    planPricing: router({
      list: superadminProcedure.query(async () => getDb().select({
        id: plans.id, code: plans.code, name: plans.name, monthlyPriceCents: plans.monthlyPriceCents,
        annualPriceCents: plans.annualPriceCents, active: plans.active, updatedAt: plans.updatedAt,
      }).from(plans).where(eq(plans.active, true))),
      update: superadminProcedure.input(z.object({
        id: z.string().uuid(),
        monthlyPriceCents: z.number().int().min(0).max(100000000),
        annualPriceCents: z.number().int().min(0).max(100000000),
      })).mutation(async ({ input, ctx }) => {
        const db = getDb();
        return db.transaction(async tx => {
          const [previous] = await tx.select().from(plans).where(eq(plans.id, input.id)).limit(1);
          if (!previous) throw new Error("Plano não encontrado");
          const [updated] = await tx.update(plans).set({
            monthlyPriceCents: input.monthlyPriceCents,
            annualPriceCents: input.annualPriceCents,
            updatedAt: new Date(),
          }).where(eq(plans.id, input.id)).returning();
          await tx.insert(auditLogs).values({
            actorUserId: ctx.user.id,
            action: "plan.price.updated",
            entityType: "plan",
            entityId: input.id,
            details: {
              code: previous.code,
              before: { monthlyPriceCents: previous.monthlyPriceCents, annualPriceCents: previous.annualPriceCents },
              after: { monthlyPriceCents: updated.monthlyPriceCents, annualPriceCents: updated.annualPriceCents },
            },
          });
          return { id: updated.id, code: updated.code, monthlyPriceCents: updated.monthlyPriceCents, annualPriceCents: updated.annualPriceCents };
        });
      }),
    }),

    radarCandidateSourceProbe: superadminProcedure.input(z.object({ source: z.enum(["tce-rs", "dados-gov"]) })).mutation(async ({input}) => probeCandidateSource(input.source)),
    radarSergipePilot: superadminProcedure.mutation(async () => probeSergipe()),
    radarTcePePilot: superadminProcedure.input(z.object({year:z.number().int().min(2011).max(2030)})).mutation(async ({input}) => {
      const result = await probeTcePe(input.year);
      return { ...result, notices: result.notices.slice(0, 100), displayed: Math.min(result.notices.length, 100), totalExtracted: result.notices.length };
    }),
    radarMgDiscovery: superadminProcedure.mutation(async () => runRadarAutomatic("amm-mg")),
    radarVerify: superadminProcedure.input(z.object({id:z.string().uuid(),deadline:z.string().datetime({offset:true}),evidence:z.string().trim().min(15).max(2000)})).mutation(({input})=>verifyRadarCandidate(input.id,input.deadline,input.evidence)),
    radarReview: superadminProcedure.query(()=>listRadarReview()),
    radarReviewStatus: superadminProcedure.input(z.object({id:z.string().uuid(),status:z.enum(["pending","rejected"])})).mutation(({input})=>setRadarReview(input.id,input.status)),
    radarPilot: superadminProcedure.input(z.object({ source: z.enum(["amm-mt","amm-mg"]), ids: z.array(z.string().regex(/^[a-f0-9]{8}$/i)).max(5).optional(), saveReview: z.boolean().optional() }).optional()).mutation(async ({input}) => {
      const startedAt = new Date();
      const source = input?.source ?? "amm-mt";
      const result = source === "amm-mg" ? await runAmmMgPilot(input?.ids ?? []) : await runAmmMtPilot();
      const notices = await compareRadarNotices(result.notices);
      const saved = input?.saveReview ? await persistRadarRun(source, startedAt, notices, result.failures) : null;
      return { ...result, notices, saved, mode: "review" as const };
    }),
    settings: router({
      get: superadminProcedure.query(async () => {
        const rows = await getDb().select().from(globalSettings);
        return Object.fromEntries(rows.map(row => [row.key, row.value]));
      }),
      save: superadminProcedure.input(z.object({
        key: z.enum(["branding", "experience", "recommendations"]),
        value: z.record(z.string(), z.unknown()),
      })).mutation(async ({ input, ctx }) => {
        const [saved] = await getDb().insert(globalSettings).values({ key: input.key, value: input.value, updatedBy: ctx.user.id, updatedAt: new Date() }).onConflictDoUpdate({ target: globalSettings.key, set: { value: input.value, updatedBy: ctx.user.id, updatedAt: new Date() } }).returning();
        await getDb().insert(auditLogs).values({ actorUserId: ctx.user.id, action: "global_settings.updated", entityType: "global_setting", entityId: input.key, details: { keys: Object.keys(input.value) } });
        return saved;
      }),
      announce: superadminProcedure.input(z.object({ title: z.string().trim().min(3).max(120), message: z.string().trim().min(5).max(1000), audience: z.enum(["all", "active"]) })).mutation(async ({ input, ctx }) => {
        const db = getDb();
        const recipients = input.audience === "active"
          ? await db.selectDistinct({ userId: companyMembers.userId }).from(companyMembers).innerJoin(subscriptions, eq(subscriptions.companyId, companyMembers.companyId)).where(eq(subscriptions.status, "active"))
          : await db.select({ userId: users.id }).from(users).where(eq(users.role, "user"));
        if (!recipients.length) return { sent: 0 };
        const rows = recipients.map(recipient => ({ userId: recipient.userId, type: "announcement", title: input.title, message: input.message, href: "/app" }));
        for (let offset = 0; offset < rows.length; offset += 500) await db.insert(notifications).values(rows.slice(offset, offset + 500));
        await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "announcement.sent", entityType: "notification", details: { title: input.title, audience: input.audience, recipientCount: rows.length } });
        return { sent: rows.length };
      }),
    }),
    overview: sourceOperatorProcedure.query(async ({ ctx }) => {
      await ensureBuiltInConnectors();
      const db = getDb();
      const canViewCommercialMetrics = ctx.user.role === "superadmin";
      const [opportunityCount, sourceRows, recentRuns] = await Promise.all([
        db.select({ n: count() }).from(opportunities),
        db.select({
          id: connectors.id, code: connectors.code, name: connectors.name,
          status: connectors.status, enabled: connectors.enabled,
          frequencySeconds: connectors.frequencySeconds, lastRunAt: connectors.lastRunAt,
          nextRunAt: connectors.nextRunAt, importedCount: connectors.importedCount,
          errorCount: connectors.errorCount, averageDurationMs: connectors.averageDurationMs,
        }).from(connectors),
        db.select({ run: syncRuns, sourceName: connectors.name }).from(syncRuns).innerJoin(connectors, eq(syncRuns.connectorId, connectors.id)).orderBy(desc(syncRuns.startedAt)).limit(8),
      ]);
      // Consultas comerciais somente para superadmin: não basta ocultar os cartões no navegador.
      const [userCount, activeSubscribers, canceledSubscriptions] = canViewCommercialMetrics
        ? await Promise.all([
            db.select({ n: count() }).from(users),
            db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.status, "active")),
            db.select({ n: count() }).from(subscriptions).where(inArray(subscriptions.status, ["cancelled", "canceled"])),
          ])
        : [null, null, null];
      return {
        ...(canViewCommercialMetrics ? {
          users: userCount?.[0]?.n ?? 0,
          activeSubscribers: activeSubscribers?.[0]?.n ?? 0,
          canceledSubscriptions: canceledSubscriptions?.[0]?.n ?? 0,
        } : {}),
        opportunities: opportunityCount[0]?.n ?? 0,
        sourceCount: sourceRows.length,
        sources: sourceRows,
        recentRuns,
      };
    }),
    sources: router({
      candidateCatalog: sourceOperatorProcedure.query(() => ({
        visibility: "admin_only" as const,
        reviewedAt: "2026-11-19",
        candidates: [
          { name: "TCE-RS — LicitaCon", url: "https://dados.tce.rs.gov.br/", access: "Arquivos CSV públicos; não é API REST confirmada", priority: "alta", status: "avaliar", notes: "Avaliar atualizações diárias, oportunidades abertas e deduplicação com PNCP." },
          { name: "Portal da Transparência — CGU", url: "https://api.portaldatransparencia.gov.br/", access: "API documentada; requer chave de acesso", priority: "média", status: "avaliar acesso", notes: "Verificar elegibilidade gratuita e sobreposição com Compras.gov.br." },
          { name: "TCE-PE — Dados Abertos / LICON", url: "https://sistemas.tce.pe.gov.br/DadosAbertos/Exemplo!listar", access: "API pública JSON/XML com métodos LicitacaoUG, LicitacoesDetalhes e LicitacoesDocumentos", priority: "alta", status: "avaliar", notes: "Cobertura estadual e municipal de Pernambuco; verificar atualização, prazos e quais processos continuam abertos antes de importar." },
          { name: "SECC Sergipe — Licitações", url: "https://portal.cge.se.gov.br/secc/transparencia/LGPDeGovernoDigital/DadosAbertos", access: "API pública sem cadastro, exportação de licitações em JSON/CSV", priority: "alta", status: "avaliar", notes: "Validar escopo dos órgãos, filtros de data, atualidade e situações abertas antes de integrar." },
          { name: "Portal Brasileiro de Dados Abertos", url: "https://dados.gov.br/", access: "Catálogo público de bases e APIs; não fornece diretamente licitações", priority: "alta", status: "descoberta", notes: "Usar no OrbeRadar para descobrir fontes municipais e estaduais." },
        ],
      })),
      list: sourceOperatorProcedure.query(async () => {
        await ensureBuiltInConnectors();
        const db = getDb();
        const [sources, runs, scheduleEvents] = await Promise.all([
          db.select({
            id: connectors.id, code: connectors.code, name: connectors.name,
            baseUrl: connectors.baseUrl, status: connectors.status, enabled: connectors.enabled,
            frequencySeconds: connectors.frequencySeconds, lastRunAt: connectors.lastRunAt,
            nextRunAt: connectors.nextRunAt, importedCount: connectors.importedCount,
            errorCount: connectors.errorCount, averageDurationMs: connectors.averageDurationMs,
            lastError: connectors.lastError,
            configuration: sql<{ scheduledTaskUid: string | null }>`jsonb_build_object('scheduledTaskUid', case when nullif(${connectors.configuration}->>'scheduledTaskUid', '') is not null then 'configured' else null end)`,
          }).from(connectors).orderBy(connectors.name),
          db.select({ run: {
            id: syncRuns.id, status: syncRuns.status, startedAt: syncRuns.startedAt,
            finishedAt: syncRuns.finishedAt, insertedCount: syncRuns.insertedCount,
            updatedCount: syncRuns.updatedCount, errorCount: syncRuns.errorCount,
          }, sourceName: connectors.name }).from(syncRuns).innerJoin(connectors, eq(syncRuns.connectorId, connectors.id)).orderBy(desc(syncRuns.startedAt)).limit(50),
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
      recoverPncpByCnpj: sourceOperatorProcedure.input(z.object({
        cnpj: z.string().regex(/^\d{14}$/),
        publicationFrom: z.string().regex(/^\d{8}$/),
        publicationTo: z.string().regex(/^\d{8}$/),
        modalityCodes: z.array(z.number().int().min(1).max(15)).min(1).max(3).default([6]),
        maxPages: z.number().int().min(1).max(10).default(3),
      })).mutation(async ({ input, ctx }) => {
        const result = await syncConnector("pncp", { ...input, mode: "publication", pageSize: 50 });
        await getDb().insert(auditLogs).values({
          actorUserId: ctx.user.id,
          action: "source.pncp.recovery",
          entityType: "connector",
          entityId: "pncp",
          details: { ...input, result },
        });
        return result;
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
    reconcileRefund: financeProcedure.input(z.object({ paymentId: z.string().trim().min(1).max(100) })).mutation(async ({ input, ctx }) => {
      try {
        return await reconcileExternallyRefundedPayment(input.paymentId, ctx.user.id);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível sincronizar o estorno." });
      }
    }),
    refundPayment: financeProcedure.input(z.object({ paymentId: z.string().trim().min(1).max(100) })).mutation(async ({ input, ctx }) => {
      try {
        return await refundMercadoPagoPayment(input.paymentId, ctx.user.id);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível estornar o pagamento." });
      }
    }),
    finance: financeProcedure.query(async () => {
      const db = getDb();
      const [activeSubscriptions, canceledSubscriptions, overdueSubscriptions, activePlans, paymentGroups, paymentGroupsWithDetails] = await Promise.all([
        db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.status, "active")),
        db.select({ n: count() }).from(subscriptions).where(inArray(subscriptions.status, ["cancelled", "canceled"])),
        db.select({ n: count() }).from(subscriptions).where(inArray(subscriptions.status, ["past_due", "expired", "inadimplente"])),
        db.select({ billingInterval: subscriptions.billingInterval, monthlyPriceCents: plans.monthlyPriceCents, annualPriceCents: plans.annualPriceCents })
          .from(subscriptions).innerJoin(plans, eq(subscriptions.planId, plans.id)).where(eq(subscriptions.status, "active")),
        db.select({ status: payments.status, amountCents: sum(payments.amountCents) }).from(payments).groupBy(payments.status),
        db.select({
          id: payments.id, providerPaymentId: payments.providerPaymentId, status: payments.status,
          amountCents: payments.amountCents, currency: payments.currency, paidAt: payments.paidAt,
          createdAt: payments.createdAt, rawStatus: payments.rawStatus,
          subscriptionId: subscriptions.id, subscriptionStatus: subscriptions.status,
          billingInterval: subscriptions.billingInterval, contractedAt: subscriptions.createdAt,
          periodStart: subscriptions.currentPeriodStart, renewalAt: subscriptions.currentPeriodEnd,
          planName: plans.name, companyName: companies.legalName, companyId: payments.companyId,
          customerName: sql<string | null>`(select u.name from company_members cm inner join users u on u.id = cm.user_id where cm.company_id = payments.company_id order by cm.created_at asc limit 1)`,
          customerEmail: sql<string | null>`(select u.email from company_members cm inner join users u on u.id = cm.user_id where cm.company_id = payments.company_id order by cm.created_at asc limit 1)`,
        }).from(payments)
          .leftJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
          .leftJoin(plans, eq(subscriptions.planId, plans.id))
          .innerJoin(companies, eq(payments.companyId, companies.id))
          .orderBy(desc(payments.createdAt)).limit(100),
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
        payments: paymentGroupsWithDetails,
        approvedRevenueCents: byStatus.approved ?? 0,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
