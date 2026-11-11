import { isDeepStrictEqual } from "node:util";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { connectors, opportunities, opportunityHistory, syncRuns } from "../../drizzle/schema";
import { searchCompras } from "../connectors/compras";
import { ConnectorError, MAX_PAGE_LIMIT, type ProcurementRecord } from "../connectors/types";
import { searchPncp, searchPncpOpen } from "../connectors/pncp";
import { ensureBuiltInConnectors } from "./opportunities";
import { getDb } from "../db";
import { buildPncpDetailUrl, normalizeProcurementStatus } from "../connectors/presentation";

export type SyncInput = {
  daysBack?: number;
  modalityCodes?: number[];
  maxPages?: number;
  allPages?: boolean;
  pageSize?: number;
  mode?: "publication" | "open";
};

type SourceCode = "pncp" | "compras.gov.br";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function dateKey(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function rawText(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function modalityStatus(record: ProcurementRecord): string {
  return normalizeProcurementStatus(record.raw);
}

function normalizeRecord(record: ProcurementRecord, sourceId: string, sourceCode: SourceCode) {
  const raw = record.raw;
  const unit = raw.unidadeOrgao && typeof raw.unidadeOrgao === "object" && !Array.isArray(raw.unidadeOrgao)
    ? raw.unidadeOrgao as Record<string, unknown>
    : {};
  const controlNumber = record.controlNumber?.trim() || null;
  const sourceKey = record.externalId?.trim() || controlNumber;
  if (!sourceKey || sourceKey.length > 300) return null;
  const publishedAt = parseDate(record.publishedAt);
  const updatedAt = parseDate(record.updatedAt);
  const openingAt = parseDate(record.proposalOpensAt);
  const deadline = parseDate(record.proposalClosesAt);
  const yearValue = raw.anoCompra ?? raw.anoCompraPncp;
  const year = typeof yearValue === "number" && Number.isInteger(yearValue) ? yearValue : null;
  const estimatedValue = typeof record.estimatedValue === "number" ? String(record.estimatedValue) : null;
  const awardedValue = typeof record.awardedValue === "number" ? String(record.awardedValue) : null;

  return {
    connectorId: sourceId,
    sourceKey,
    controlNumber,
    procurementNumber: rawText(raw, ["numeroCompra", "sequencialCompra"]),
    processNumber: rawText(raw, ["processo", "numeroProcesso"]),
    year,
    modality: record.modalityName ?? (record.modalityCode !== null ? `Modalidade ${record.modalityCode}` : null),
    procurementType: rawText(raw, ["tipoInstrumentoConvocatorioNomePncp", "tipoInstrumentoConvocatorioNome"]),
    title: record.title?.trim() || record.description?.trim() || "Objeto não informado",
    description: record.description,
    summary: null,
    agencyName: record.organizationName,
    unitName: record.unitName,
    agencyCnpj: record.organizationCnpj,
    state: rawText(raw, ["unidadeOrgaoUfSigla"]) ?? rawText(unit, ["ufSigla"]),
    municipality: rawText(raw, ["unidadeOrgaoMunicipioNome"]) ?? rawText(unit, ["municipioNome"]),
    address: null,
    publicationDate: publishedAt,
    openingDate: openingAt,
    sessionAt: parseDate(rawText(raw, ["dataSessaoPublica", "dataHoraSessao"])),
    proposalDeadline: deadline,
    estimatedValue,
    awardedValue,
    status: modalityStatus(record),
    judgmentCriterion: rawText(raw, ["criterioJulgamentoNome", "criterioJulgamento"]),
    disputeMode: rawText(raw, ["modoDisputaNome", "modoDisputaIdPncp"]),
    sourceUrl: buildPncpDetailUrl({ agencyCnpj: record.organizationCnpj, raw }),
    noticeUrl: null,
    documents: [] as Array<Record<string, unknown>>,
    itemCount: typeof raw.quantidadeItens === "number" ? raw.quantidadeItens : null,
    lastSourceUpdateAt: updatedAt,
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
    rawData: { source: record.source, raw: record.raw },
  };
}

export function comparableChanges(existing: typeof opportunities.$inferSelect, next: ReturnType<typeof normalizeRecord>) {
  if (!next) return null;
  const fields = [
    "procurementNumber", "processNumber", "year", "modality", "procurementType", "title", "description", "summary",
    "agencyName", "unitName", "agencyCnpj", "state", "municipality", "address", "publicationDate", "openingDate",
    "sessionAt", "proposalDeadline", "estimatedValue", "awardedValue", "status", "judgmentCriterion", "disputeMode",
    "sourceUrl", "noticeUrl", "documents", "itemCount", "lastSourceUpdateAt",
  ] as const;
  const dateFields = new Set<string>(["publicationDate", "openingDate", "sessionAt", "proposalDeadline", "lastSourceUpdateAt"]);
  const previousValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  for (const field of fields) {
    const oldValue = dateFields.has(field)
      ? dateKey(existing[field] as Date | null)
      : existing[field];
    const newValue = dateFields.has(field)
      ? dateKey(next[field] as Date | null)
      : next[field];
    if (!isDeepStrictEqual(oldValue ?? null, newValue ?? null)) {
      previousValues[field] = oldValue ?? null;
      newValues[field] = newValue ?? null;
    }
  }
  return Object.keys(previousValues).length ? { previousValues, newValues } : null;
}

function dateOnly(date: Date, compact: boolean): string {
  const iso = date.toISOString().slice(0, 10);
  return compact ? iso.replace(/-/g, "") : iso;
}

export async function syncConnector(sourceCode: SourceCode, input: SyncInput = {}) {
  await ensureBuiltInConnectors();
  const db = getDb();
  const [source] = await db.select().from(connectors).where(eq(connectors.code, sourceCode)).limit(1);
  if (!source) throw new Error("Fonte não cadastrada.");
  if (!source.enabled) throw new Error("Esta fonte está desativada.");
  const mode = input.mode ?? "publication";
  if (mode === "open" && sourceCode !== "pncp") {
    throw new ConnectorError("The open-proposals query is available only in the official PNCP API.", "invalid_input", sourceCode);
  }

  const daysBack = Math.min(30, Math.max(1, input.daysBack ?? 7));
  const allPages = input.allPages === true;
  const maxPages = allPages ? MAX_PAGE_LIMIT : Math.min(MAX_PAGE_LIMIT, Math.max(1, input.maxPages ?? 1));
  const modalityCodes = mode === "open"
    ? []
    : [...new Set(input.modalityCodes?.length ? input.modalityCodes : [6])];
  const queryModalities: Array<number | undefined> = mode === "open" ? [undefined] : modalityCodes;
  const pageSize = input.pageSize ?? 50;
  const now = new Date();
  const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const runStartedAt = new Date();
  const queryConcurrency = sourceCode === "compras.gov.br" ? 3 : 1;
  const runMetadata = { daysBack, modalityCodes, maxPages, allPages, pageSize, mode, queryConcurrency };
  const [run] = await db.insert(syncRuns).values({ connectorId: source.id, status: "running", startedAt: runStartedAt, metadata: runMetadata }).returning();
  await db.update(connectors).set({ status: "running", lastRunAt: runStartedAt, updatedAt: new Date() }).where(eq(connectors.id, source.id));

  let fetched = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let pagesFetched = 0;
  let reportedTotalRecords = 0;
  let hasReportedTotal = false;
  const pageStats: Array<Record<string, number | null>> = [];
  const failures: string[] = [];
  const durationStart = Date.now();
  try {
    for (let queryOffset = 0; queryOffset < queryModalities.length; queryOffset += queryConcurrency) {
      const modalityBatch = queryModalities.slice(queryOffset, queryOffset + queryConcurrency);
      const queryResults = await Promise.all(modalityBatch.map(async modalityCode => {
        try {
          const pages = sourceCode === "pncp"
            ? mode === "open"
              ? await searchPncpOpen({ dataFinal: dateOnly(now, true), page: 1, maxPages, allPages, tamanhoPagina: pageSize })
              : await searchPncp({ dataInicial: dateOnly(from, true), dataFinal: dateOnly(now, true), codigoModalidadeContratacao: modalityCode!, page: 1, maxPages, allPages, tamanhoPagina: pageSize })
            : await searchCompras({ dataPublicacaoPncpInicial: dateOnly(from, false), dataPublicacaoPncpFinal: dateOnly(now, false), codigoModalidade: modalityCode!, page: 1, maxPages, allPages, tamanhoPagina: pageSize });
          return { modalityCode, pages, error: null as unknown };
        } catch (error) {
          return { modalityCode, pages: null, error };
        }
      }));
      let queryFailure: { error: unknown } | null = null;
      for (const queryResult of queryResults) {
        if (!queryResult.pages) {
          queryFailure ??= { error: queryResult.error };
          continue;
        }
        const { modalityCode, pages } = queryResult;
        for (const page of pages) {
        pagesFetched++;
        pageStats.push({
          modalityCode: modalityCode ?? null,
          page: page.metadata.page,
          totalPages: page.metadata.totalPages,
          totalRecords: page.metadata.totalRecords,
          pagesRemaining: page.metadata.pagesRemaining,
          returned: page.metadata.returned,
        });
        if (page.metadata.page === 1 && page.metadata.totalRecords !== null) {
          reportedTotalRecords += page.metadata.totalRecords;
          hasReportedTotal = true;
        }
        const batchSize = 100;
        for (let offset = 0; offset < page.items.length; offset += batchSize) {
          const batch = page.items.slice(offset, offset + batchSize);
          fetched += batch.length;
          const prepared: Array<{ record: ProcurementRecord; next: NonNullable<ReturnType<typeof normalizeRecord>> }> = [];
          const seenSourceKeys = new Set<string>();
          const seenControlNumbers = new Set<string>();
          for (const record of batch) {
            const next = normalizeRecord(record, source.id, sourceCode);
            if (!next || seenSourceKeys.has(next.sourceKey) || (next.controlNumber && seenControlNumbers.has(next.controlNumber))) {
              skipped++;
              continue;
            }
            seenSourceKeys.add(next.sourceKey);
            if (next.controlNumber) seenControlNumbers.add(next.controlNumber);
            prepared.push({ record, next });
          }
          if (!prepared.length) continue;

          const sourceKeys = prepared.map(({ next }) => next.sourceKey);
          const controlNumbers = [...new Set(prepared.map(({ next }) => next.controlNumber).filter((value): value is string => Boolean(value)))];
          const sameSourceCondition = and(eq(opportunities.connectorId, source.id), inArray(opportunities.sourceKey, sourceKeys));
          const lookupConditions = [sameSourceCondition];
          if (controlNumbers.length) lookupConditions.push(inArray(opportunities.controlNumber, controlNumbers));
          const lookupCondition = or(...lookupConditions);
          const existingRows = lookupCondition
            ? await db.select().from(opportunities).where(lookupCondition)
            : [];
          const existingBySourceKey = new Map(existingRows.filter(row => row.connectorId === source.id).map(row => [row.sourceKey, row]));
          const existingByControlNumber = new Map(existingRows.filter(row => row.controlNumber).map(row => [row.controlNumber!, row]));
          const inserts: Array<NonNullable<ReturnType<typeof normalizeRecord>>> = [];
          const unchangedRows: Array<typeof opportunities.$inferSelect> = [];
          const pendingUpdates: Array<{
            existing: typeof opportunities.$inferSelect;
            values: Record<string, unknown>;
            change: ReturnType<typeof comparableChanges>;
          }> = [];

          for (const { record, next } of prepared) {
            const existing = existingBySourceKey.get(next.sourceKey)
              ?? (next.controlNumber ? existingByControlNumber.get(next.controlNumber) : undefined);
            if (!existing) {
              inserts.push(next);
              continue;
            }

            const change = comparableChanges(existing, next);
            const existingRaw = existing.rawData && typeof existing.rawData === "object" ? existing.rawData : {};
            const { connectorId: _incomingConnectorId, sourceKey: _incomingSourceKey, ...incomingValues } = next;
            const rawData = existing.connectorId === source.id
              ? next.rawData
              : {
                  ...existingRaw,
                  observedSources: [...new Set([
                    ...(Array.isArray(existingRaw.observedSources) ? existingRaw.observedSources.filter((value): value is string => typeof value === "string") : []),
                    sourceCode,
                  ])],
                  rawBySource: {
                    ...(existingRaw.rawBySource && typeof existingRaw.rawBySource === "object" ? existingRaw.rawBySource : {}),
                    [sourceCode]: record.raw,
                  },
            };
            if (!change && isDeepStrictEqual(existingRaw, rawData)) {
              unchangedRows.push(existing);
              continue;
            }
            pendingUpdates.push({
              existing,
              values: {
                ...(existing.connectorId === source.id ? next : incomingValues),
                lastSyncedAt: new Date(),
                rawData: rawData as Record<string, unknown>,
                updatedAt: new Date(),
              },
              change,
            });
          }

          const upsertRows: Array<typeof opportunities.$inferInsert> = [
            ...unchangedRows.map(existing => ({ ...existing, lastSyncedAt: new Date() })),
            ...pendingUpdates.map(({ existing, values }) => ({ ...existing, ...values } as typeof opportunities.$inferInsert)),
          ];
          if (inserts.length || upsertRows.length) {
            const historyRows = pendingUpdates.flatMap(({ existing, change }) => change ? [{
              opportunityId: existing.id,
              eventType: "source_update",
              summary: "A fonte oficial atualizou informações desta oportunidade.",
              previousValues: change.previousValues,
              newValues: change.newValues,
            }] : []);
            const createdCount = await db.transaction(async tx => {
              let createdRows = 0;
              if (inserts.length) {
                const created = await tx.insert(opportunities).values(inserts).onConflictDoNothing().returning({ id: opportunities.id });
                createdRows = created.length;
              }
              if (upsertRows.length) await tx.insert(opportunities).values(upsertRows).onConflictDoUpdate({
                target: opportunities.id,
                set: {
                  connectorId: sql`excluded.connector_id`,
                  sourceKey: sql`excluded.source_key`,
                  controlNumber: sql`excluded.control_number`,
                  procurementNumber: sql`excluded.procurement_number`,
                  processNumber: sql`excluded.process_number`,
                  year: sql`excluded.year`,
                  modality: sql`excluded.modality`,
                  procurementType: sql`excluded.procurement_type`,
                  title: sql`excluded.title`,
                  description: sql`excluded.description`,
                  summary: sql`excluded.summary`,
                  agencyName: sql`excluded.agency_name`,
                  unitName: sql`excluded.unit_name`,
                  agencyCnpj: sql`excluded.agency_cnpj`,
                  state: sql`excluded.state`,
                  municipality: sql`excluded.municipality`,
                  address: sql`excluded.address`,
                  publicationDate: sql`excluded.publication_date`,
                  openingDate: sql`excluded.opening_date`,
                  sessionAt: sql`excluded.session_at`,
                  proposalDeadline: sql`excluded.proposal_deadline`,
                  estimatedValue: sql`excluded.estimated_value`,
                  awardedValue: sql`excluded.awarded_value`,
                  status: sql`excluded.status`,
                  judgmentCriterion: sql`excluded.judgment_criterion`,
                  disputeMode: sql`excluded.dispute_mode`,
                  sourceUrl: sql`excluded.source_url`,
                  noticeUrl: sql`excluded.notice_url`,
                  documents: sql`excluded.documents`,
                  itemCount: sql`excluded.item_count`,
                  lastSourceUpdateAt: sql`excluded.last_source_update_at`,
                  lastSyncedAt: sql`excluded.last_synced_at`,
                  rawData: sql`excluded.raw_data`,
                  updatedAt: sql`excluded.updated_at`,
                },
              });
              if (historyRows.length) await tx.insert(opportunityHistory).values(historyRows);
              return createdRows;
            });
            inserted += createdCount;
            skipped += inserts.length - createdCount;
            updated += historyRows.length;
          }
        }
        }
      }
      if (queryFailure) throw queryFailure.error;
    }
    const duration = Date.now() - durationStart;
    await db.update(syncRuns).set({ status: "completed", finishedAt: new Date(), fetchedCount: fetched, insertedCount: inserted, updatedCount: updated, errorCount: failures.length, metadata: { ...runMetadata, pagesFetched, pageStats, reportedTotalRecords: hasReportedTotal ? reportedTotalRecords : null, skipped } }).where(eq(syncRuns.id, run.id));
    await db.update(connectors).set({ status: "active", importedCount: source.importedCount + inserted, errorCount: source.errorCount, lastError: null, averageDurationMs: duration, nextRunAt: new Date(Date.now() + source.frequencySeconds * 1000), updatedAt: new Date() }).where(eq(connectors.id, source.id));
    return { sourceCode, mode, pagesFetched, reportedTotalRecords: hasReportedTotal ? reportedTotalRecords : null, fetched, inserted, updated, skipped, durationMs: duration, runId: run.id };
  } catch (error) {
    const duration = Date.now() - durationStart;
    const errorCode = error instanceof ConnectorError ? `${error.code}${error.status ? `_${error.status}` : ""}` : "sync_failed";
    await db.update(syncRuns).set({ status: "failed", finishedAt: new Date(), fetchedCount: fetched, insertedCount: inserted, updatedCount: updated, errorCount: 1, errorSummary: errorCode, metadata: { ...runMetadata, pagesFetched, pageStats, reportedTotalRecords: hasReportedTotal ? reportedTotalRecords : null, skipped } }).where(eq(syncRuns.id, run.id));
    await db.update(connectors).set({ status: "error", errorCount: source.errorCount + 1, lastError: errorCode, averageDurationMs: duration, updatedAt: new Date() }).where(eq(connectors.id, source.id));
    throw new Error(`Falha ao consultar a fonte oficial (${errorCode}).`);
  }
}
