type RawRecord = Readonly<Record<string, unknown>>;

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

export function normalizeProcurementStatus(rawValue: unknown, fallback = "unknown"): string {
  const raw = asRecord(rawValue);
  const text = [
    raw.situacaoCompraNomePncp,
    raw.situacaoCompraNome,
    raw.situacaoNome,
    raw.status,
  ].map(textValue).find((value): value is string => value !== null);
  if (!text) return fallback;

  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("suspens")) return "suspended";
  if (normalized.includes("revog")) return "revoked";
  if (normalized.includes("anulad")) return "annulled";
  if (normalized.includes("homolog")) return "homologated";
  if (normalized.includes("adjudic")) return "awarded";
  if (normalized.includes("julg")) return "judging";
  if (normalized.includes("receb") || normalized.includes("proposta")) return "receiving_proposals";
  if (normalized.includes("abert") || normalized.includes("andamento")) return "open";
  if (normalized.includes("encerr") || normalized.includes("finaliz")) return "closed";
  if (normalized.includes("divulg") || normalized.includes("publicad")) return "published";
  return "unknown";
}
