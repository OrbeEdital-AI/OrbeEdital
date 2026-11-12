import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lt, lte, or, sum } from "drizzle-orm";
import {
  companyMembers,
  connectors,
  syncRuns,
  favorites,
  opportunities,
  opportunityHistory,
  opportunityItems,
  savedSearches,
  type SafeUser,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { buildPncpDetailUrl, normalizeProcurementStatus } from "../connectors/presentation";

export type OpportunityFilters = {
  query?: string;
  states?: string[];
  municipality?: string;
  modalities?: string[];
  statuses?: string[];
  source?: string;
  minValue?: number;
  maxValue?: number;
  publishedFrom?: string;
  publishedTo?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  onlyOpen?: boolean;
  page?: number;
  pageSize?: number;
};

export const OPPORTUNITIES_PAGE_SIZE = 25;
const OPEN_STATUSES = ["unknown", "published", "receiving_proposals", "open", "in_progress"];

export function brazilDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)])) as { year: number; month: number; day: number };
}

export function brazilDayBounds(value: Date) {
  const { year, month, day } = brazilDateParts(value);
  const start = new Date(`${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}T00:00:00-03:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function brazilGreeting(value: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(value));
  return hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
}

const publicConnectorSeeds = [
  { code: "pncp", name: "PNCP — API de Consulta", baseUrl: "https://pncp.gov.br/api/consulta", integrationType: "official_api" },
  { code: "compras.gov.br", name: "Compras.gov.br — Dados Abertos", baseUrl: "https://dadosabertos.compras.gov.br", integrationType: "official_api" },
];

function rawRecord(opportunity: typeof opportunities.$inferSelect): Record<string, unknown> {
  const raw = opportunity.rawData?.raw;
  return raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
}

function presentOpportunity(opportunity: typeof opportunities.$inferSelect) {
  const raw = rawRecord(opportunity);
  const { rawData: _rawData, ...publicOpportunity } = opportunity;
  return {
    ...publicOpportunity,
    sourceUrl: buildPncpDetailUrl({ agencyCnpj: opportunity.agencyCnpj, raw }),
    status: normalizeProcurementStatus(raw, opportunity.status),
  };
}

export async function ensureBuiltInConnectors() {
  const db = getDb();
  for (const source of publicConnectorSeeds) {
    await db.insert(connectors).values(source).onConflictDoUpdate({
      target: connectors.code,
      set: { name: source.name, baseUrl: source.baseUrl, integrationType: source.integrationType, updatedAt: new Date() },
    });
  }
}

function buildFilters(filters: OpportunityFilters) {
  const clauses = [];
  const query = filters.query?.trim();
  if (query) {
    const like = `%${query.replace(/[%_]/g, "\\$&")}%`;
    const matches = [
      ilike(opportunities.title, like),
      ilike(opportunities.description, like),
      ilike(opportunities.agencyName, like),
      ilike(opportunities.processNumber, like),
      ilike(opportunities.procurementNumber, like),
      ilike(opportunities.agencyCnpj, like),
    ];
    clauses.push(or(...matches)!);
  }
  if (filters.states?.length) clauses.push(inArray(opportunities.state, filters.states.map(state => state.toUpperCase())));
  if (filters.municipality?.trim()) clauses.push(ilike(opportunities.municipality, `%${filters.municipality.trim()}%`));
  if (filters.modalities?.length) clauses.push(inArray(opportunities.modality, filters.modalities));
  if (filters.statuses?.length) clauses.push(inArray(opportunities.status, filters.statuses));
  if (filters.minValue !== undefined) clauses.push(gte(opportunities.estimatedValue, String(filters.minValue)));
  if (filters.maxValue !== undefined) clauses.push(lte(opportunities.estimatedValue, String(filters.maxValue)));
  if (filters.publishedFrom) clauses.push(gte(opportunities.publicationDate, new Date(filters.publishedFrom)));
  if (filters.publishedTo) clauses.push(lte(opportunities.publicationDate, new Date(filters.publishedTo)));
  if (filters.deadlineFrom) clauses.push(gte(opportunities.proposalDeadline, new Date(filters.deadlineFrom)));
  if (filters.deadlineTo) clauses.push(lte(opportunities.proposalDeadline, new Date(filters.deadlineTo)));
  if (filters.source) clauses.push(eq(connectors.code, filters.source));
  if (filters.onlyOpen) {
    clauses.push(gte(opportunities.proposalDeadline, new Date()));
    clauses.push(inArray(opportunities.status, ["unknown", "published", "receiving_proposals", "open", "in_progress"]));
  }
  return clauses.length ? and(...clauses) : undefined;
}

export async function searchOpportunities(filters: OpportunityFilters, userId: string) {
  const db = getDb();
  const where = buildFilters(filters);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = OPPORTUNITIES_PAGE_SIZE;
  const [totalRow] = await db.select({ total: count() }).from(opportunities).innerJoin(connectors, eq(opportunities.connectorId, connectors.id)).where(where);
  const rows = await db.select({ opportunity: opportunities, sourceName: connectors.name, sourceCode: connectors.code })
    .from(opportunities)
    .innerJoin(connectors, eq(opportunities.connectorId, connectors.id))
    .where(where)
    .orderBy(asc(opportunities.proposalDeadline), desc(opportunities.publicationDate), asc(opportunities.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const ids = rows.map(row => row.opportunity.id);
  const saved = ids.length ? await db.select({ id: favorites.opportunityId }).from(favorites).where(and(eq(favorites.userId, userId), inArray(favorites.opportunityId, ids))) : [];
  const favoriteIds = new Set(saved.map(row => row.id));
  return {
    total: totalRow?.total ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(totalRow?.total ?? 0) / pageSize)),
    items: rows.map(row => {
      return { ...presentOpportunity(row.opportunity), sourceName: row.sourceName, sourceCode: row.sourceCode, isFavorite: favoriteIds.has(row.opportunity.id) };
    }),
  };
}

export async function getOpportunityDetail(id: string, userId: string) {
  const db = getDb();
  const rows = await db.select({ opportunity: opportunities, sourceName: connectors.name, sourceCode: connectors.code })
    .from(opportunities).innerJoin(connectors, eq(opportunities.connectorId, connectors.id))
    .where(eq(opportunities.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const [items, history, saved] = await Promise.all([
    db.select().from(opportunityItems).where(eq(opportunityItems.opportunityId, id)),
    db.select().from(opportunityHistory).where(eq(opportunityHistory.opportunityId, id)).orderBy(desc(opportunityHistory.happenedAt)).limit(30),
    db.select({ id: favorites.id }).from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.opportunityId, id))).limit(1),
  ]);
  return { ...presentOpportunity(row.opportunity), sourceName: row.sourceName, sourceCode: row.sourceCode, isFavorite: saved.length > 0, items, history };
}

export async function listFavorites(userId: string) {
  const rows = await getDb().select({ opportunity: opportunities, sourceName: connectors.name })
    .from(favorites)
    .innerJoin(opportunities, eq(favorites.opportunityId, opportunities.id))
    .innerJoin(connectors, eq(opportunities.connectorId, connectors.id))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));
  return rows.map(row => {
    return { ...presentOpportunity(row.opportunity), sourceName: row.sourceName, isFavorite: true };
  });
}

export async function toggleFavorite(userId: string, opportunityId: string) {
  const db = getDb();
  const existing = await db.select({ id: favorites.id }).from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.opportunityId, opportunityId))).limit(1);
  if (existing.length) {
    await db.delete(favorites).where(eq(favorites.id, existing[0].id));
    return false;
  }
  await db.insert(favorites).values({ userId, opportunityId }).onConflictDoNothing();
  return true;
}

export async function getDashboardSummary(user: SafeUser) {
  await ensureBuiltInConnectors();
  const db = getDb();
  const now = new Date();
  const today = brazilDayBounds(now);
  const nextWeek = new Date(today.end.getTime() + 7 * 24 * 60 * 60 * 1000);
  const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [all, open, closingToday, closingSoon, fresh, withoutDeadline, value, savedCount, byState, byModality, sourceRows, lastRuns] = await Promise.all([
    db.select({ n: count() }).from(opportunities),
    db.select({ n: count() }).from(opportunities).where(and(gte(opportunities.proposalDeadline, now), inArray(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count() }).from(opportunities).where(and(gte(opportunities.proposalDeadline, today.start), lt(opportunities.proposalDeadline, today.end), inArray(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count() }).from(opportunities).where(and(gte(opportunities.proposalDeadline, now), lt(opportunities.proposalDeadline, nextWeek), inArray(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count() }).from(opportunities).where(gte(opportunities.createdAt, day)),
    db.select({ n: count() }).from(opportunities).where(isNull(opportunities.proposalDeadline)),
    db.select({ n: sum(opportunities.estimatedValue) }).from(opportunities),
    db.select({ n: count() }).from(favorites).where(eq(favorites.userId, user.id)),
    db.select({ label: opportunities.state, n: count() }).from(opportunities).where(inArray(opportunities.status, OPEN_STATUSES)).groupBy(opportunities.state).orderBy(desc(count())).limit(8),
    db.select({ label: opportunities.modality, n: count() }).from(opportunities).groupBy(opportunities.modality).orderBy(desc(count())).limit(8),
    db.select().from(connectors).orderBy(asc(connectors.name)),
    db.select({ run: syncRuns, sourceCode: connectors.code }).from(syncRuns).innerJoin(connectors, eq(syncRuns.connectorId, connectors.id)).orderBy(desc(syncRuns.startedAt)).limit(100),
  ]);
  const recentRows = await db.select({ opportunity: opportunities, sourceName: connectors.name })
    .from(opportunities).innerJoin(connectors, eq(opportunities.connectorId, connectors.id))
    .orderBy(desc(opportunities.publicationDate)).limit(6);
  const recent = recentRows.map(row => {
    return { ...presentOpportunity(row.opportunity), sourceName: row.sourceName };
  });
  return {
    total: all[0]?.n ?? 0,
    open: open[0]?.n ?? 0,
    closingToday: closingToday[0]?.n ?? 0,
    closingSoon: closingSoon[0]?.n ?? 0,
    new24h: fresh[0]?.n ?? 0,
    withoutDeadline: withoutDeadline[0]?.n ?? 0,
    estimatedValue: value[0]?.n ?? "0",
    favorites: savedCount[0]?.n ?? 0,
    byState: byState.filter(row => row.label).map(row => ({ label: row.label as string, value: row.n })),
    byModality: byModality.filter(row => row.label).map(row => ({ label: row.label as string, value: row.n })),
    sources: sourceRows.filter(source => source.enabled || lastRuns.some(row => row.sourceCode === source.code)).map(source => {
      const runs = lastRuns.filter(row => row.sourceCode === source.code);
      const lastSuccessful = runs.find(row => ["completed", "succeeded", "success"].includes(row.run.status));
      const lastFailed = runs.find(row => ["failed", "error"].includes(row.run.status));
      const status = !source.enabled ? "disabled" : lastFailed && (!lastSuccessful || new Date(lastFailed.run.startedAt) > new Date(lastSuccessful.run.startedAt)) ? "error" : lastSuccessful ? "active" : "pending";
      return { code: source.code, name: source.name, status, lastRunAt: lastSuccessful?.run.finishedAt ?? null, importedCount: source.importedCount, errorCount: lastFailed?.run.errorCount ?? source.errorCount };
    }),
    recent,
  };
}

export async function getCompanyIdForUser(userId: string): Promise<string | null> {
  const [row] = await getDb().select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq(companyMembers.userId, userId)).limit(1);
  return row?.companyId ?? null;
}

export async function listSavedSearches(userId: string) {
  return getDb().select().from(savedSearches).where(eq(savedSearches.userId, userId)).orderBy(desc(savedSearches.updatedAt));
}

export async function saveSearch(userId: string, name: string, criteria: Record<string, unknown>) {
  const companyId = await getCompanyIdForUser(userId);
  const [row] = await getDb().insert(savedSearches).values({ userId, companyId, name, criteria, updatedAt: new Date() }).returning();
  return row;
}

export async function deleteSavedSearch(userId: string, id: string): Promise<boolean> {
  const result = await getDb().delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId))).returning({ id: savedSearches.id });
  return result.length > 0;
}
