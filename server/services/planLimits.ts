import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  companyMembers,
  favorites,
  planUsage,
  plans,
  savedSearches,
  subscriptions,
} from "../../drizzle/schema";
import { getDb } from "../db";

type LimitKey = "maxSearchesPerMonth" | "maxFavorites" | "maxSavedSearches";
type UsageKey = "searchesThisMonth" | "favorites" | "savedSearches";

function currentPeriodStart() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  return `${year}-${month}-01`;
}

async function getCompanyId(userId: string) {
  const [membership] = await getDb().select({ companyId: companyMembers.companyId })
    .from(companyMembers).where(eq(companyMembers.userId, userId)).limit(1);
  return membership?.companyId ?? null;
}

async function getActivePlan(companyId: string) {
  const [row] = await getDb().select({
    subscriptionId: subscriptions.id,
    planId: plans.id,
    code: plans.code,
    name: plans.name,
    description: plans.description,
    monthlyPriceCents: plans.monthlyPriceCents,
    limits: plans.limits,
    features: plans.features,
    currentPeriodEnd: subscriptions.currentPeriodEnd,
    status: subscriptions.status,
    provider: subscriptions.provider,
    providerSubscriptionId: subscriptions.providerSubscriptionId,
  }).from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(and(eq(subscriptions.companyId, companyId), inArray(subscriptions.status, ["active", "trialing"]), eq(plans.active, true)))
    .orderBy(desc(subscriptions.createdAt)).limit(1);
  return row ?? null;
}

async function getCompanyCounts(companyId: string, userIds: string[]) {
  const db = getDb();
  const [favoriteRows, savedRows] = await Promise.all([
    db.select({ total: count() }).from(favorites)
      .innerJoin(companyMembers, eq(favorites.userId, companyMembers.userId))
      .where(eq(companyMembers.companyId, companyId)),
    db.select({ total: count() }).from(savedSearches)
      .where(or(eq(savedSearches.companyId, companyId), inArray(savedSearches.userId, userIds))),
  ]);
  return {
    favorites: Number(favoriteRows[0]?.total ?? 0),
    savedSearches: Number(savedRows[0]?.total ?? 0),
  };
}

export async function getPlanUsageSummary(userId: string) {
  const db = getDb();
  const companyId = await getCompanyId(userId);
  if (!companyId) {
    return { hasSubscription: false, plan: null, limits: null, usage: { searchesThisMonth: 0, favorites: 0, savedSearches: 0 }, periodStart: currentPeriodStart() };
  }
  const [plan, members, monthlyRows] = await Promise.all([
    getActivePlan(companyId),
    db.select({ userId: companyMembers.userId }).from(companyMembers).where(eq(companyMembers.companyId, companyId)),
    db.select({ searchesCount: planUsage.searchesCount }).from(planUsage)
      .where(and(eq(planUsage.companyId, companyId), eq(planUsage.periodStart, currentPeriodStart()))).limit(1),
  ]);
  const userIds = members.map(member => member.userId);
  const counts = await getCompanyCounts(companyId, userIds);
  return {
    hasSubscription: Boolean(plan),
    plan: plan ? {
      id: plan.planId,
      code: plan.code,
      name: plan.name,
      monthlyPriceCents: plan.monthlyPriceCents,
      currentPeriodEnd: plan.currentPeriodEnd,
      status: plan.status,
      canChangePlan: plan.provider === "mercadopago" && Boolean(plan.providerSubscriptionId),
    } : null,
    limits: plan?.limits ?? null,
    usage: {
      searchesThisMonth: Number(monthlyRows[0]?.searchesCount ?? 0),
      favorites: counts.favorites,
      savedSearches: counts.savedSearches,
    },
    periodStart: currentPeriodStart(),
  };
}

async function assertWithinLimit(userId: string, limitKey: LimitKey, usageKey: UsageKey) {
  const summary = await getPlanUsageSummary(userId);
  if (!summary.hasSubscription || !summary.limits) {
    throw new Error("Sua empresa ainda não possui uma assinatura ativa. Escolha um plano para continuar.");
  }
  const limit = Number(summary.limits[limitKey] ?? 0);
  const used = Number(summary.usage[usageKey] ?? 0);
  if (limit > 0 && used >= limit) {
    const messages: Record<LimitKey, string> = {
      maxSearchesPerMonth: "Você atingiu o limite mensal de pesquisas do seu plano. Faça upgrade para continuar.",
      maxFavorites: "Você atingiu o limite de oportunidades favoritas do seu plano. Remova um favorito ou faça upgrade.",
      maxSavedSearches: "Você atingiu o limite de pesquisas salvas do seu plano. Exclua uma pesquisa ou faça upgrade.",
    };
    throw new Error(messages[limitKey]);
  }
}

export async function recordSearchUsage(userId: string) {
  const db = getDb();
  const companyId = await getCompanyId(userId);
  if (!companyId) throw new Error("Sua empresa ainda não possui uma assinatura ativa. Escolha um plano para continuar.");
  const plan = await getActivePlan(companyId);
  if (!plan) throw new Error("Sua empresa ainda não possui uma assinatura ativa. Escolha um plano para continuar.");
  const limit = Number(plan.limits.maxSearchesPerMonth ?? 0);
  const periodStart = currentPeriodStart();
  const result = await db.execute(sql`
    INSERT INTO public.plan_usage (company_id, period_start, searches_count, updated_at)
    VALUES (${companyId}::uuid, ${periodStart}::date, 1, now())
    ON CONFLICT (company_id, period_start)
    DO UPDATE SET searches_count = public.plan_usage.searches_count + 1, updated_at = now()
    WHERE ${limit} <= 0 OR public.plan_usage.searches_count < ${limit}
    RETURNING searches_count
  `);
  const rows = result.rows as Array<{ searches_count: number }>;
  if (!rows.length) {
    throw new Error("Você atingiu o limite mensal de pesquisas do seu plano. Faça upgrade para continuar.");
  }
  return Number(rows[0].searches_count);
}

export async function ensureCanAddFavorite(userId: string) {
  await assertWithinLimit(userId, "maxFavorites", "favorites");
}

export async function ensureCanSaveSearch(userId: string) {
  await assertWithinLimit(userId, "maxSavedSearches", "savedSearches");
}
