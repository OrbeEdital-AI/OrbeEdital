import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, lte, or, sql, sum } from "drizzle-orm";
import {
  companyMembers,
  companyProfiles,
  companies,
  globalSettings,
  connectors,
  favorites,
  opportunities,
  opportunityHistory,
  opportunityItems,
  savedSearches,
  type SafeUser,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { buildPncpDetailUrl, hasDeadlineExtension, normalizeProcurementStatus } from "../connectors/presentation";
import { indexOpportunityItems } from "./pncpItemIndex";
import { buildPncpHistoryUrl, fetchPncpHistory } from "./pncpHistory";

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
  createdFrom?: string;
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
    deadlineExtended: hasDeadlineExtension(raw),
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

const SEARCH_ACCENTED = "áàâãäåéèêëíìîïóòôõöúùûüçñ";
const SEARCH_PLAIN = "aaaaaaeeeeiiiiooooouuuucn";
function normalizedSearchField(field: unknown) {
  return sql`translate(lower(coalesce(${field}, '')), ${SEARCH_ACCENTED}, ${SEARCH_PLAIN})`;
}

function buildFilters(filters: OpportunityFilters) {
  const clauses = [];
  const query = filters.query?.trim();
  if (query) {
    // All meaningful terms must match the SAME product description (or the same
    // notice title/description), not unrelated fields/items within a notice.
    // Quoted queries enforce a contiguous exact phrase, ignoring case/accents.
    const quoted = /^["“](.*)["”]$/.exec(query);
    const cleaned = (quoted?.[1] ?? query).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const tokens = cleaned.match(/[a-z0-9]+(?:[.,][0-9]+)?/g) ?? [];
    const stopwords = new Set(["de", "da", "do", "das", "dos", "em", "para", "com", "um", "uma"]);
    const terms = tokens.filter(token => !stopwords.has(token)).slice(0, 24);
    // General-purpose lexical search: no product-specific dictionary.
    // PostgreSQL Portuguese stemming handles ordinary inflections; LIKE fallback
    // retains technical codes such as 15W, 43, AB-123 and other literal terms.
    const textFields = [
      sql`concat_ws(' ', ${opportunities.title}, ${opportunities.description})`,
    ];
    const itemText = sql`concat_ws(' ', oi.description, oi.specifications, oi.catalog_code)`;
    const normalized = (field: ReturnType<typeof sql>) =>
      sql`translate(lower(${field}), ${SEARCH_ACCENTED}, ${SEARCH_PLAIN})`;
    const pattern = (term: string) => "%" + term.replace(/[\\%_]/g, "\\$&") + "%";
    const match = (field: ReturnType<typeof sql>) => {
      const value = normalized(field);
      if (quoted) return sql`${value} like ${pattern(cleaned)}`;
      // Require every meaningful term in the SAME combined notice text or item.
      // Portuguese stemming applies to alphabetic words, while numbers/model
      // identifiers remain literal and mandatory.
      // One full-text predicate per field, rather than a costly vector
      // reconstruction for each word. Literal technical specs remain required.
      const lexical = terms.filter(term => /^[a-z]{4,}$/.test(term));
      const technical = terms.filter(term => !/^[a-z]{4,}$/.test(term));
      return and(
        ...(lexical.length ? [or(
          and(...lexical.map(term => sql`${value} like ${pattern(term)}`))!,
          sql`to_tsvector('portuguese', ${field}) @@ plainto_tsquery('portuguese', ${lexical.join(" ")})`
        )!] : []),
        ...technical.map(term => sql`${value} like ${pattern(term)}`)
      )!;
    };
    if (terms.length) {
      clauses.push(or(
        ...textFields.map(match),
        sql`exists (
          select 1 from opportunity_items oi
          where oi.opportunity_id = ${opportunities.id}
          and (${match(itemText)})
        )`,
      )!);
    }
  }
  if (filters.states?.length) clauses.push(inArray(opportunities.state, filters.states.map(state => state.toUpperCase())));
  if (filters.municipality?.trim()) clauses.push(ilike(opportunities.municipality, `%${filters.municipality.trim()}%`));
  if (filters.modalities?.length) clauses.push(inArray(opportunities.modality, filters.modalities));
  if (filters.statuses?.length) clauses.push(inArray(opportunities.status, filters.statuses));
  if (filters.minValue !== undefined) clauses.push(gte(opportunities.estimatedValue, String(filters.minValue)));
  if (filters.maxValue !== undefined) clauses.push(lte(opportunities.estimatedValue, String(filters.maxValue)));
  if (filters.publishedFrom) clauses.push(gte(opportunities.publicationDate, new Date(filters.publishedFrom)));
  if (filters.publishedTo) clauses.push(lte(opportunities.publicationDate, new Date(filters.publishedTo)));
  if (filters.createdFrom) clauses.push(gte(opportunities.createdAt, new Date(filters.createdFrom)));
  if (filters.deadlineFrom) clauses.push(gte(opportunities.proposalDeadline, new Date(filters.deadlineFrom)));
  if (filters.deadlineTo) clauses.push(lt(opportunities.proposalDeadline, new Date(filters.deadlineTo)));
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
  // Count and page retrieval") + "%";
  const relevance = phrase
    ? sql<number>`(
        case when ${normalizedSearchField(opportunities.title)} like ${phrasePattern} then 100 else 0 end
        + case when ${normalizedSearchField(opportunities.description)} like ${phrasePattern} then 70 else 0 end
        + case when exists (
          select 1 from opportunity_items oi where oi.opportunity_id = ${opportunities.id}
          and translate(lower(coalesce(oi.description, '')), ${SEARCH_ACCENTED}, ${SEARCH_PLAIN}) like ${phrasePattern}
        ) then 90 else 0 end
      )`
    : sql<number>`0`;
  // Count and page retrieval are independent; execute concurrently to reduce request latency.
  const [countRows, rows] = await Promise.all([
    db.select({ total: count() }).from(opportunities).innerJoin(connectors, eq(opportunities.connectorId, connectors.id)).where(where),
    db.select({ opportunity: opportunities, sourceName: connectors.name, sourceCode: connectors.code })
    .from(opportunities)
    .innerJoin(connectors, eq(opportunities.connectorId, connectors.id))
    .where(where)
    .orderBy(desc(opportunities.publicationDate), desc(opportunities.lastSyncedAt), asc(opportunities.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize),
  ]);
  const totalRow = countRows[0];
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
  const pncpHistoryInput = {
    agencyCnpj: row.opportunity.agencyCnpj,
    year: row.opportunity.year,
    controlNumber: row.opportunity.controlNumber,
    rawData: row.opportunity.rawData,
  };
  const pncpBacked = row.sourceCode === "pncp"
    || row.opportunity.sourceUrl?.startsWith("https://pncp.gov.br/app/editais/") === true
    || buildPncpHistoryUrl(pncpHistoryInput) !== null;
  const [storedItems, history, saved, pncpHistory] = await Promise.all([
    db.select().from(opportunityItems).where(eq(opportunityItems.opportunityId, id)),
    db.select().from(opportunityHistory).where(eq(opportunityHistory.opportunityId, id)).orderBy(desc(opportunityHistory.happenedAt)).limit(30),
    db.select({ id: favorites.id }).from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.opportunityId, id))).limit(1),
    pncpBacked ? fetchPncpHistory(pncpHistoryInput).catch(() => null) : Promise.resolve(undefined),
  ]);
  let items = storedItems;
  if (!items.length) {
    try {
      const recovered = await indexOpportunityItems({
        id: row.opportunity.id,
        agencyCnpj: row.opportunity.agencyCnpj,
        year: row.opportunity.year,
        controlNumber: row.opportunity.controlNumber,
        rawData: row.opportunity.rawData,
      });
      if (recovered.length) items = recovered;
    } catch {
      // Preserve the rest of the detail page if the upstream item API is unavailable.
    }
  }
  return { ...presentOpportunity(row.opportunity), sourceName: row.sourceName, sourceCode: row.sourceCode, isFavorite: saved.length > 0, items, history, pncpHistory };
}

export async function listFavorites(userId: string) {
  const rows = await getDb().select({ opportunity: opportunities, sourceName: connectors.name })
    .from(favorites)
    .innerJoin(opportunities, eq(favorites.opportunityId, opportunities.id))
    .innerJoin(connectors, eq(opportunities.connectorId, connectors.id))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(opportunities.lastSyncedAt), desc(favorites.createdAt));
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
  const days1to3End = new Date(today.end.getTime() + 3 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(today.end.getTime() + 7 * 24 * 60 * 60 * 1000);
  const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [all, open, closingToday, closing1to3, closing4to7, fresh, withoutDeadline, value, savedCount, byState, byModality, sourceRows] = await Promise.all([
    db.select({ n: count() }).from(opportunities),
    db.select({ n: count() }).from(opportunities).where(and(gte(opportunities.proposalDeadline, now), inArray(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count() }).from(opportunities).where(and(gte(opportunities.proposalDeadline, now), lt(opportunities.proposalDeadline, today.end), inArray(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count() }).from(opportunities).where(and(gte(opportunities.proposalDeadline, today.end), lt(opportunities.proposalDeadline, days1to3End), inArray(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count() }).from(opportunities).where(and(gte(opportunities.proposalDeadline, days1to3End), lt(opportunities.proposalDeadline, nextWeek), inArray(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count() }).from(opportunities).where(and(gte(opportunities.createdAt, day), gte(opportunities.proposalDeadline, now), inArray(opportunities.status, OPEN_STATUSES))),
    db.select({ n: count() }).from(opportunities).where(isNull(opportunities.proposalDeadline)),
    db.select({ n: sum(opportunities.estimatedValue) }).from(opportunities),
    db.select({ n: count() }).from(favorites).where(eq(favorites.userId, user.id)),
    db.select({ label: opportunities.state, n: count() }).from(opportunities).where(inArray(opportunities.status, OPEN_STATUSES)).groupBy(opportunities.state).orderBy(desc(count())).limit(8),
    db.select({ label: opportunities.modality, n: count() }).from(opportunities).groupBy(opportunities.modality).orderBy(desc(count())).limit(8),
    db.select().from(connectors).orderBy(asc(connectors.name)),
  ]);
  const latestRunResult = await db.execute(sql`
    SELECT DISTINCT ON (connector_id)
      connector_id,
      status,
      started_at,
      finished_at,
      fetched_count,
      inserted_count,
      updated_count,
      error_count,
      error_summary
    FROM public.sync_runs
    ORDER BY connector_id, started_at DESC
  `);
  const latestRuns = latestRunResult.rows as Array<{
    connector_id: string;
    status: string;
    started_at: Date | string;
    finished_at: Date | string | null;
    fetched_count: number;
    inserted_count: number;
    updated_count: number;
    error_count: number;
    error_summary: string | null;
  }>;
  const historicalErrorResult = await db.execute(sql`
    SELECT
      connector_id,
      COUNT(*) FILTER (WHERE status IN ('failed', 'error'))::int AS failed_runs,
      COALESCE(SUM(error_count) FILTER (WHERE status IN ('failed', 'error')), 0)::int AS historical_error_count,
      MAX(started_at) FILTER (WHERE status IN ('failed', 'error')) AS last_failure_at
    FROM public.sync_runs
    GROUP BY connector_id
  `);
  const historicalErrors = historicalErrorResult.rows as Array<{
    connector_id: string;
    failed_runs: number;
    historical_error_count: number;
    last_failure_at: Date | string | null;
  }>;
  const latestByConnector = new Map(latestRuns.map(run => [run.connector_id, run]));
  const historicalByConnector = new Map(historicalErrors.map(row => [row.connector_id, row]));
  const recentRows = await db.select({ opportunity: opportunities, sourceName: connectors.name })
    .from(opportunities).innerJoin(connectors, eq(opportunities.connectorId, connectors.id))
    .where(and(gte(opportunities.proposalDeadline, now), inArray(opportunities.status, OPEN_STATUSES), isNotNull(opportunities.publicationDate)))
    .orderBy(desc(opportunities.publicationDate), desc(opportunities.createdAt)).limit(6);
  const recent = recentRows.map(row => {
    return { ...presentOpportunity(row.opportunity), sourceName: row.sourceName };
  });
  return {
    total: all[0]?.n ?? 0,
    open: open[0]?.n ?? 0,
    closingToday: closingToday[0]?.n ?? 0,
    closingSoon: (closingToday[0]?.n ?? 0) + (closing1to3[0]?.n ?? 0) + (closing4to7[0]?.n ?? 0),
    closing1to3: closing1to3[0]?.n ?? 0,
    closing4to7: closing4to7[0]?.n ?? 0,
    dashboardFilters: {
      today: { deadlineFrom: now.toISOString(), deadlineTo: today.end.toISOString() },
      days1to3: { deadlineFrom: today.end.toISOString(), deadlineTo: days1to3End.toISOString() },
      days4to7: { deadlineFrom: days1to3End.toISOString(), deadlineTo: nextWeek.toISOString() },
      new24h: { createdFrom: day.toISOString() },
      favoriteUrgent: { deadlineFrom: now.toISOString(), deadlineTo: nextWeek.toISOString() },
    },
    new24h: fresh[0]?.n ?? 0,
    withoutDeadline: withoutDeadline[0]?.n ?? 0,
    estimatedValue: value[0]?.n ?? "0",
    favorites: savedCount[0]?.n ?? 0,
    byState: byState.filter(row => row.label).map(row => ({ label: row.label as string, value: row.n })),
    byModality: byModality.filter(row => row.label).map(row => ({ label: row.label as string, value: row.n })),
    sources: sourceRows.filter(source => source.enabled || latestByConnector.has(source.id)).map(source => {
      const latest = latestByConnector.get(source.id);
      const historical = historicalByConnector.get(source.id);
      const latestFailed = latest && ["failed", "error"].includes(latest.status);
      const latestSucceeded = latest && ["completed", "succeeded", "success"].includes(latest.status);
      const status = !source.enabled ? "disabled" : latestFailed ? "error" : latestSucceeded ? "active" : "pending";
      return {
        code: source.code,
        name: source.name,
        status,
        lastRunAt: latest?.finished_at ?? null,
        lastRunStatus: latest?.status ?? null,
        lastRunErrorCount: latestFailed ? latest.error_count : 0,
        lastRunErrorSummary: latestFailed ? latest.error_summary : null,
        historicalErrorRuns: historical?.failed_runs ?? 0,
        historicalErrorCount: historical?.historical_error_count ?? 0,
        lastFailureAt: historical?.last_failure_at ?? null,
        importedCount: source.importedCount,
        errorCount: latestFailed ? latest.error_count : 0,
      };
    }),
    recent,
  };
}

/** Only audited content changes on opportunities this user bookmarked; a sync alone is not an event. */
export async function getRecommendedOpportunities(userId: string) {
  const db = getDb();
  const [membership] = await db.select({ profile: companyProfiles, state: companies.state, segment: companies.primarySegment })
    .from(companyMembers).innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .leftJoin(companyProfiles, eq(companyProfiles.companyId, companies.id))
    .where(eq(companyMembers.userId, userId)).limit(1);
  const profile = membership?.profile;
  const terms = [...new Set([...(profile?.products ?? []), ...(profile?.services ?? []), ...(profile?.keywords ?? []), ...(profile?.segments ?? []), membership?.segment ?? ""]
    .map(t => t.trim().toLowerCase()).filter(t => t.length >= 3))].slice(0, 40);
  if (!terms.length) return { configured: false, items: [] };
  const [settings] = await db.select({ value: globalSettings.value }).from(globalSettings).where(eq(globalSettings.key, "recommendations")).limit(1);
  const config = (settings?.value ?? {}) as Record<string, unknown>;
  if (config.enabled === false) return { configured: true, items: [] };
  const limit = Math.min(12, Math.max(1, Number(config.maxItems) || 6));
  const servedStates = (profile?.servedStates ?? []).map(s => s.toUpperCase());
  const searchTerms = terms.slice(0, 20);
  const matches = searchTerms.map(term => {
    const like = "%" + term.replace(/[%_]/g, "\\$&") + "%";
    return or(ilike(opportunities.title, like), ilike(opportunities.description, like),
      sql`exists(select 1 from opportunity_items oi where oi.opportunity_id = ${opportunities.id} and oi.description ilike ${like})`)!;
  });
  const now = new Date();
  const rows = await db.select({ opportunity: opportunities, sourceName: connectors.name })
    .from(opportunities).innerJoin(connectors, eq(opportunities.connectorId, connectors.id))
    .where(and(gte(opportunities.proposalDeadline, now), inArray(opportunities.status, OPEN_STATUSES), or(...matches)))
    .orderBy(desc(opportunities.publicationDate)).limit(250);
  const scored = rows.flatMap(row => {
    const o = row.opportunity;
    if (servedStates.length && o.state && !servedStates.includes(o.state.toUpperCase())) return [];
    const value = Number(o.estimatedValue);
    if (profile?.minimumValue && Number.isFinite(value) && value < Number(profile.minimumValue)) return [];
    if (profile?.maximumValue && Number.isFinite(value) && value > Number(profile.maximumValue)) return [];
    const text = [o.title, o.description].filter(Boolean).join(" ").toLowerCase();
    const matched = terms.filter(t => text.includes(t));
    const score = matched.length * 10 + (servedStates.includes(o.state ?? "") ? 4 : 0);
    return [{ ...presentOpportunity(o), sourceName: row.sourceName, matchReasons: matched.slice(0, 4), matchScore: score, matchBasis: matched.length ? "objeto e descrição" : "itens indexados" }];
  });
  scored.sort((a,b) => b.matchScore - a.matchScore || new Date(b.publicationDate ?? 0).getTime() - new Date(a.publicationDate ?? 0).getTime());
  return { configured: true, items: scored.slice(0, limit) };
}

export async function getFavoriteChanges(userId: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await getDb()
    .select({
      id: opportunityHistory.id,
      opportunityId: opportunities.id,
      title: opportunities.title,
      happenedAt: opportunityHistory.happenedAt,
      eventType: opportunityHistory.eventType,
      summary: opportunityHistory.summary,
      previousValues: opportunityHistory.previousValues,
      newValues: opportunityHistory.newValues,
    })
    .from(opportunityHistory)
    .innerJoin(favorites, eq(favorites.opportunityId, opportunityHistory.opportunityId))
    .innerJoin(opportunities, eq(opportunities.id, opportunityHistory.opportunityId))
    .where(and(eq(favorites.userId, userId), gte(opportunityHistory.happenedAt, since)))
    .orderBy(desc(opportunityHistory.happenedAt))
    .limit(60);
  const changeLabels: Record<string, string> = {
    documents: "Documentos alterados",
    proposalDeadline: "Prazo de propostas alterado",
    openingDate: "Abertura alterada",
    sessionAt: "Sessão alterada",
    title: "Objeto alterado",
    description: "Descrição alterada",
    estimatedValue: "Valor estimado alterado",
    status: "Situação alterada",
    itemCount: "Quantidade de itens alterada",
    items: "Itens alterados",
  };
  return rows.flatMap(row => {
    const before = row.previousValues ?? {};
    const after = row.newValues ?? {};
    const changed = Object.keys(after).filter(key =>
      Object.prototype.hasOwnProperty.call(changeLabels, key) && JSON.stringify(before[key]) !== JSON.stringify(after[key])
    );
    if (!changed.length) return [];
    return [{
      id: row.id,
      opportunityId: row.opportunityId,
      title: row.title,
      happenedAt: row.happenedAt,
      description: changed.map(key => changeLabels[key]).join(" · "),
      origin: "Alteração registrada na coleta da fonte",
    }];
  }).slice(0, 8);
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
