type RawRecord = Readonly<Record<string, unknown>>;

const STATUS_FIELDS = [
  "situacaoCompraNomePncp",
  "situacaoCompraNome",
  "situacaoNome",
  "status",
  "statusCompra",
  "statusProcesso",
  "statusLicitacao",
  "situacao",
  "situacaoLicitacao",
  "nomeSituacao",
] as const;

const EVENT_LIST_FIELDS = ["eventos", "historico", "history", "timeline"] as const;
const EVENT_TEXT_FIELDS = [
  "nomeEvento",
  "tipoEvento",
  "nome",
  "titulo",
  "status",
  "descricao",
  "justificativa",
] as const;

function asRecord(value: unknown): RawRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RawRecord
    : {};
}

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function integerValue(value: unknown): number | null {
  const text = textValue(value);
  if (!text || !/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function normalizeStatusText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function recordTexts(record: RawRecord, keys: readonly string[]) {
  return keys
    .map(key => textValue(record[key]))
    .filter((value): value is string => value !== null);
}

function statusTexts(raw: RawRecord) {
  return recordTexts(raw, STATUS_FIELDS);
}

function eventTexts(raw: RawRecord) {
  return EVENT_LIST_FIELDS.flatMap(field => {
    const entries = raw[field];
    if (!Array.isArray(entries)) return [];
    return entries.flatMap(entry => recordTexts(asRecord(entry), EVENT_TEXT_FIELDS));
  });
}

/**
 * Build the public, human-readable PNCP detail route from official identifiers.
 * Deliberately never falls back to an API root or a filtered JSON request URL.
 */
export function buildPncpDetailUrl(input: {
  agencyCnpj?: string | null;
  raw: RawRecord;
}): string | null {
  const raw = input.raw;
  const organization = asRecord(raw.orgaoEntidade);
  const cnpjCandidates = [
    input.agencyCnpj,
    raw.orgaoEntidadeCnpj,
    raw.orgaoEntidadeCnpjPncp,
    organization.cnpj,
  ];
  const cnpj = cnpjCandidates
    .map(textValue)
    .filter((value): value is string => value !== null)
    .map(value => value.replace(/\D/g, ""))
    .find(value => /^\d{14}$/.test(value));

  const year = integerValue(raw.anoCompra) ?? integerValue(raw.anoCompraPncp);
  const sequence = integerValue(raw.sequencialCompra) ?? integerValue(raw.sequencialCompraPncp);
  if (!cnpj || !year || year < 2000 || year > 2100 || !sequence || sequence < 1) return null;

  return `https://pncp.gov.br/app/editais/${cnpj}/${year}/${sequence}`;
}

/** True only when the source explicitly reports a deadline extension. */
export function hasDeadlineExtension(rawValue: unknown): boolean {
  const raw = asRecord(rawValue);
  return [...statusTexts(raw), ...eventTexts(raw)]
    .some(text => normalizeStatusText(text).includes("prorrog"));
}

export function normalizeProcurementStatus(rawValue: unknown, fallback = "unknown"): string {
  const texts = statusTexts(asRecord(rawValue));
  if (!texts.length) return fallback;

  const normalized = texts.map(normalizeStatusText).join(" ");
  if (normalized.includes("suspens")) return "suspended";
  if (normalized.includes("revog") || normalized.includes("revok")) return "revoked";
  if (normalized.includes("anul") || normalized.includes("annul")) return "annulled";
  if (normalized.includes("homolog")) return "homologated";
  if (normalized.includes("adjudic") || normalized.includes("award")) return "awarded";
  if (normalized.includes("julg") || normalized.includes("judg")) return "judging";
  if (normalized.includes("receb") || normalized.includes("proposta") || normalized.includes("proposal")) return "receiving_proposals";
  if (normalized.includes("abert") || normalized.includes("andamento") || normalized.includes("open") || normalized.includes("in_progress")) return "open";
  if (normalized.includes("encerr") || normalized.includes("finaliz") || normalized.includes("closed")) return "closed";
  if (normalized.includes("divulg") || normalized.includes("publicad") || normalized.includes("published")) return "published";
  return "unknown";
}
