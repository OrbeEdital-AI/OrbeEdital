import { and, asc, eq, gt, sql } from "drizzle-orm";
import { connectors, opportunities, opportunityItems } from "../../drizzle/schema";
import { getDb } from "../db";

/** Incremental, bounded PNCP item indexing. Never infers items from the procurement title. */
export async function indexPncpItems(limit = 80) {
  const db = getDb();
  const [connector] = await db.select().from(connectors).where(eq(connectors.code, "pncp")).limit(1);
  if (!connector) return { scanned: 0, indexed: 0, failures: 0 };
  const config = connector.configuration ?? {};
  const cursor = typeof config.itemsCursor === "string" ? config.itemsCursor : "";
  const rows = await db.select({ id: opportunities.id, agencyCnpj: opportunities.agencyCnpj, year: opportunities.year, rawData: opportunities.rawData })
    .from(opportunities)
    .where(and(eq(opportunities.connectorId, connector.id), gt(opportunities.id, cursor || "00000000-0000-0000-0000-000000000000")))
    .orderBy(asc(opportunities.id)).limit(Math.min(Math.max(limit, 1), 100));
  let indexed = 0, failures = 0;
  for (let offset = 0; offset < rows.length; offset += 8) {
   await Promise.all(rows.slice(offset, offset + 8).map(async row => {
    try {
      const raw = (row.rawData?.raw ?? {}) as Record<string, unknown>;
      const seq = Number(raw.sequencialCompra);
      const year = Number(raw.anoCompra ?? row.year);
      const cnpj = row.agencyCnpj?.replace(/\D/g, "");
      if (!cnpj || cnpj.length !== 14 || !Number.isInteger(year) || !Number.isInteger(seq) || seq < 1) continue;
      const url = new URL(`https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${year}/${seq}/itens`);
      url.searchParams.set("pagina", "1");
      url.searchParams.set("tamanhoPagina", "500");
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
      if (!response.ok) { failures++; continue; }
      const body: unknown = await response.json();
      const data = Array.isArray(body) ? body : (body && typeof body === "object" && Array.isArray((body as {data?:unknown}).data) ? (body as {data:unknown[]}).data : []);
      const mapped = data.slice(0, 500).flatMap((value: unknown) => {
        if (!value || typeof value !== "object") return [];
        const item = value as Record<string, unknown>;
        const description = typeof item.descricao === "string" ? item.descricao.trim() : "";
        if (!description) return [];
        const numeric = (key: string) => typeof item[key] === "number" && Number.isFinite(item[key]) ? String(item[key]) : null;
        return [{ opportunityId: row.id, itemNumber: item.numeroItem == null ? null : String(item.numeroItem), description,
          catalogCode: item.codigoItem == null ? null : String(item.codigoItem),
          quantity: numeric("quantidade"), unit: typeof item.unidadeMedida === "string" ? item.unidadeMedida : null,
          estimatedUnitValue: numeric("valorUnitarioEstimado"), estimatedTotalValue: numeric("valorTotal") }];
      });
      if (mapped.length) {
        await db.transaction(async tx => {
          await tx.delete(opportunityItems).where(eq(opportunityItems.opportunityId, row.id));
          for (let i = 0; i < mapped.length; i += 100) await tx.insert(opportunityItems).values(mapped.slice(i, i + 100));
        });
        indexed += mapped.length;
      }
    } catch { failures++; }
   }));
  }
  // Advance even after an individual source failure; next full sweep retries it.
  const itemsCursor = rows.length < limit ? "" : rows.at(-1)!.id;
  await db.update(connectors).set({ configuration: { ...config, itemsCursor }, updatedAt: new Date() }).where(eq(connectors.id, connector.id));
  return { scanned: rows.length, indexed, failures };
}
