type JsonRecord = Record<string, unknown>;

export type PncpHistoryEvent = {
  id: string;
  event: string;
  name: string;
  happenedAt: string;
  justification: string;
};

export type PncpHistoryInput = {
  agencyCnpj: string | null;
  year: number | null;
  controlNumber: string | null;
  rawData: JsonRecord | null;
};

const PAGE_SIZE = 100;
const MAX_HISTORY_PAGES = 20;
const PNCP_API = "https://pncp.gov.br/api/pncp/v1";

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function procurementIdentity(input: PncpHistoryInput) {
  const raw = asRecord(asRecord(input.rawData).raw);
  const cnpjCandidate = input.agencyCnpj ?? text(raw.orgaoEntidadeCnpj) ?? text(asRecord(raw.orgaoEntidade).cnpj);
  const cnpj = cnpjCandidate?.replace(/\D/g, "") ?? "";
  const control = input.controlNumber ?? text(raw.numeroControlePNCP) ?? "";
  const controlMatch = control.match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/);
  const cnpjFromControl = controlMatch?.[1];
  const year = positiveInteger(input.year) ?? positiveInteger(controlMatch?.[3]) ?? positiveInteger(raw.anoCompra) ?? positiveInteger(raw.anoCompraPncp);
  const sequence = positiveInteger(controlMatch?.[2]) ?? positiveInteger(raw.sequencialCompra) ?? positiveInteger(raw.sequencialCompraPncp);
  const resolvedCnpj = /^\d{14}$/.test(cnpj) ? cnpj : cnpjFromControl ?? "";
  if (!/^\d{14}$/.test(resolvedCnpj) || !year || year < 2000 || year > 2100 || !sequence) return null;
  return { cnpj: resolvedCnpj, year, sequence };
}

export function buildPncpHistoryUrl(input: PncpHistoryInput) {
  const identity = procurementIdentity(input);
  if (!identity) return null;
  return `${PNCP_API}/orgaos/${identity.cnpj}/compras/${identity.year}/${identity.sequence}/historico`;
}

export function mapPncpHistoryRecords(records: unknown[]): PncpHistoryEvent[] {
  return records.flatMap((value, index) => {
    const record = asRecord(value);
    const type = text(record.tipoLogManutencaoNome);
    const category = text(record.categoriaLogManutencaoNome);
    const event = [type, category].filter((part): part is string => part !== null).join(" - ");
    const happenedAt = text(record.logManutencaoDataInclusao);
    if (!event || !happenedAt) return [];
    const name = text(record.documentoTitulo) ?? text(record.documentoAtaTitulo) ?? text(record.tituloDocumentoContrato) ?? "";
    const justification = text(record.justificativa) ?? "Exigência Legal";
    const documentSequence = text(record.documentoSequencial) ?? "";
    const itemNumber = text(record.itemNumero) ?? "";
    return [{
      id: `${happenedAt}|${event}|${documentSequence}|${itemNumber}|${index}`,
      event,
      name,
      happenedAt,
      justification,
    }];
  });
}

async function requestJson(url: string, fetcher: typeof fetch) {
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`PNCP history API returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function fetchPncpHistory(input: PncpHistoryInput, fetcher: typeof fetch = fetch): Promise<PncpHistoryEvent[] | null> {
  const baseUrl = buildPncpHistoryUrl(input);
  if (!baseUrl) return null;

  const quantityPayload = await requestJson(`${baseUrl}/quantidade`, fetcher);
  if (quantityPayload === null) return [];
  const totalRecords = Number(quantityPayload);
  if (!Number.isSafeInteger(totalRecords) || totalRecords < 0) throw new Error("PNCP returned an invalid history count");
  if (totalRecords === 0) return [];

  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
  if (totalPages > MAX_HISTORY_PAGES) throw new Error(`PNCP history exceeds the safe page limit of ${MAX_HISTORY_PAGES}`);
  const allRecords: unknown[] = [];
  for (let page = 1; page <= totalPages; page++) {
    const url = new URL(baseUrl);
    url.searchParams.set("pagina", String(page));
    url.searchParams.set("tamanhoPagina", String(PAGE_SIZE));
    const payload = await requestJson(url.toString(), fetcher);
    if (payload === null) break;
    const records = Array.isArray(payload)
      ? payload
      : [asRecord(payload).data, asRecord(payload).items, asRecord(payload).content].find(Array.isArray) as unknown[] | undefined ?? [];
    allRecords.push(...records);
    if (records.length < PAGE_SIZE) break;
  }
  return mapPncpHistoryRecords(allRecords);
}
