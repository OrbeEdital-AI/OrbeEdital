import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { connectors, opportunities, opportunityHistory, opportunityItems } from "../../drizzle/schema";
import { getDb } from "../db";
import { compareOpportunityItems, summarizeOpportunityItemChanges, type OpportunityItemSnapshot } from "./opportunityItemHistory";

type ItemOpportunity = {
  id: string;
  agencyCnpj: string | null;
  year: number | null;
  controlNumber: string | null;
  rawData: Record<string, unknown> | null;
};

function itemUrl(row: ItemOpportunity) {
  const raw = row.rawData?.raw;
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const control = row.controlNumber ?? (typeof record.numeroControlePNCP === "string" ? record.numeroControlePNCP : null);
  const sequence = Number(record.sequencialCompra ?? control?.match(/-\d-(\d+)\/\d{4}$/)?.[1]);
  const year = Number(control?.match(/\/(\d{4})$/)?.[1] ?? record.anoCompra ?? row.year);
  const cnpj = (control?.split("-")[0] || row.agencyCnpj || "").replace(/\D/g, "");
  if (cnpj.length !== 14 || !Number.isInteger(year) || !Number.isInteger(sequence) || sequence < 1) return null;
  return new URL(`https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${year}/${sequence}/itens`);
}

/** Fetches and persists every official PNCP page of items for one opportunity. */
export async function indexOpportunityItems(row: ItemOpportunity) {
  const baseUrl = itemUrl(row);
  if (!baseUrl) return [];
  const fetched: unknown[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = new URL(baseUrl);
    url.searchParams.set("pagina", String(page));
    url.searchParams.set("tamanhoPagina", "500");
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`PNCP item API returned ${response.status}`);
    const body: unknown = await response.json();
    const object = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
    const data = Array.isArray(body) ? body : [object?.data, object?.items, object?.resultado, object?.results].find(Array.isArray) as unknown[] | undefined ?? [];
    fetched.push(...data);
    const totalPages = Number(object?.totalPaginas ?? object?.totalPages);
    if (page === 20 && data.length === 500 && (!Number.isFinite(totalPages) || totalPages > 20)) {
      throw new Error("PNCP item API page count exceeds the safe indexing limit");
    }
    if (!data.length || (Number.isFinite(totalPages) && totalPages > 0 && page >= totalPages) || data.length < 500) break;
  }
  const mapped = fetched.flatMap(value => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    const description = [item.descricao, item.descricaoDetalhada, item.descricaoComplementar].find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)?.trim();
    if (!description) return [];
    const sourceItemKey = item.numeroItem ?? item.itemId ?? item.id ?? item.identificadorItem;
    const numeric = (...keys: string[]) => {
      for (const key of keys) {
        const value = item[key];
        if (typeof value === "number" && Number.isFinite(value)) return String(value);
        if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return String(Number(value));
      }
      return null;
    };
    const catalog = item.catalogo && typeof item.catalogo === "object" ? item.catalogo as Record<string, unknown> : null;
    return [{
      opportunityId: row.id,
      itemNumber: item.numeroItem == null ? null : String(item.numeroItem),
      description,
      catalogCode: item.codigoItem == null ? item.catalogoCodigoItem == null ? null : String(item.catalogoCodigoItem) : String(item.codigoItem),
      catalogSystem: typeof item.catalogo === "string" ? item.catalogo : typeof catalog?.nome === "string" ? catalog.nome : null,
      quantity: numeric("quantidade"),
      unit: typeof item.unidadeMedida === "string" ? item.unidadeMedida : null,
      estimatedUnitValue: numeric("valorUnitarioEstimado"),
      estimatedTotalValue: numeric("valorTotal", "valorTotalEstimado"),
      specifications: [item.especificacao, item.descricaoDetalhada, item.descricaoComplementar].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0 && entry.trim() !== description).join("\n") || null,
      sourceItemKey: sourceItemKey == null ? null : String(sourceItemKey),
    }];
  });
  const db = getDb();
  const existing = await db.select().from(opportunityItems).where(eq(opportunityItems.opportunityId, row.id));
  const toSnapshot = (item: typeof existing[number] | typeof mapped[number]): OpportunityItemSnapshot => ({
    sourceItemKey: item.sourceItemKey,
    itemNumber: item.itemNumber,
    description: item.description,
    catalogCode: item.catalogCode,
    catalogSystem: item.catalogSystem,
    quantity: item.quantity,
    unit: item.unit,
    estimatedUnitValue: item.estimatedUnitValue,
    estimatedTotalValue: item.estimatedTotalValue,
    specifications: item.specifications,
  });
  const changes = existing.length && mapped.length ? compareOpportunityItems(existing.map(toSnapshot), mapped.map(toSnapshot)) : null;
  const summary = changes ? summarizeOpportunityItemChanges(changes) : null;
  await db.transaction(async tx => {
    if (mapped.length && (changes?.altered.length || changes?.added.length || changes?.removed.length)) {
      await tx.delete(opportunityItems).where(eq(opportunityItems.opportunityId, row.id));
      for (let offset = 0; offset < mapped.length; offset += 100) await tx.insert(opportunityItems).values(mapped.slice(offset, offset + 100));
    } else if (mapped.length && !existing.length) {
      for (let offset = 0; offset < mapped.length; offset += 100) await tx.insert(opportunityItems).values(mapped.slice(offset, offset + 100));
    }
    await tx.update(opportunities).set({ itemsSyncedAt: new Date() }).where(eq(opportunities.id, row.id));
    if (summary && changes) {
      await tx.insert(opportunityHistory).values({
        opportunityId: row.id,
        eventType: "source_items_update",
        summary,
        previousValues: { items: { altered: changes.altered.map(item => ({ itemNumber: item.itemNumber, description: item.description, fields: Object.fromEntries(Object.entries(item.changes).map(([field, values]) => [field, values.previous])) })), removed: changes.removed.map(({ itemNumber, description }) => ({ itemNumber, description })) } },
        newValues: { items: { altered: changes.altered.map(item => ({ itemNumber: item.itemNumber, description: item.description, fields: Object.fromEntries(Object.entries(item.changes).map(([field, values]) => [field, values.next])) })), added: changes.added.map(({ itemNumber, description }) => ({ itemNumber, description })) } },
      });
    }
  });
  return db.select().from(opportunityItems).where(eq(opportunityItems.opportunityId, row.id));
}

/** Incremental, bounded PNCP item indexing. Never infers items from the procurement title. */
export async function indexPncpItems(limit = 160) {
  const db = getDb();
  const [connector] = await db.select().from(connectors).where(eq(connectors.code, "pncp")).limit(1);
  if (!connector) return { scanned: 0, indexed: 0, failures: 0 };
  const config = connector.configuration ?? {};
  const cursor = typeof config.itemsCursor === "string" ? config.itemsCursor : "";
  const staleItems = or(
    and(sql`not exists (select 1 from opportunity_items oi where oi.opportunity_id = ${opportunities.id})`, sql`${opportunities.itemsSyncedAt} is null`),
    and(sql`${opportunities.lastSourceUpdateAt} is not null`, or(sql`${opportunities.itemsSyncedAt} is null`, gt(opportunities.lastSourceUpdateAt, opportunities.itemsSyncedAt))),
  );
  const rows = await db.select({ id: opportunities.id, agencyCnpj: opportunities.agencyCnpj, year: opportunities.year, controlNumber: opportunities.controlNumber, rawData: opportunities.rawData })
    .from(opportunities)
    .where(and(inArray(opportunities.connectorId, db.select({ id: connectors.id }).from(connectors).where(inArray(connectors.code, ["pncp", "compras.gov.br"]))), gt(opportunities.id, cursor || "00000000-0000-0000-0000-000000000000"), staleItems))
    .orderBy(asc(opportunities.id)).limit(Math.min(Math.max(limit, 1), 180));
  let indexed = 0, failures = 0;
  for (let offset = 0; offset < rows.length; offset += 12) {
   await Promise.all(rows.slice(offset, offset + 12).map(async row => {
    try {
      indexed += (await indexOpportunityItems(row)).length;
    } catch { failures++; }
   }));
  }
  // Advance even after an individual source failure; next full sweep retries it.
  const itemsCursor = rows.length < Math.min(Math.max(limit, 1), 180) ? "" : rows.at(-1)!.id;
  await db.update(connectors).set({ configuration: sql`jsonb_set(coalesce(${connectors.configuration}, '{}'::jsonb), '{itemsCursor}', to_jsonb(${itemsCursor}::text), true)`, updatedAt: new Date() }).where(eq(connectors.id, connector.id));
  return { scanned: rows.length, indexed, failures };
}
