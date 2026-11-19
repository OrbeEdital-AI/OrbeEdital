/** TCE-PE public API pilot. Read-only; never publishes opportunities to customers. */
const ENDPOINT = "https://sistemas.tce.pe.gov.br/DadosAbertos/LicitacaoUG!json";
export type TcePeNotice = {
  key: string; agency: string | null; object: string | null;
  modality: string | null; situation: string | null; sessionDate: string | null;
  estimatedValue: number | null; documentUrl: string | null;
  raw: Record<string, unknown>;
};
function field(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return value === null || value === undefined || String(value).trim() === "" ? null : String(value).trim();
}
export async function probeTcePe(year: number, timeoutMs = 15000): Promise<{
  notices: TcePeNotice[]; count: number; truncated: boolean; status: string; endpoint: string;
}> {
  if (!Number.isInteger(year) || year < 2011 || year > new Date().getFullYear() + 1) throw new Error("Invalid year");
  const url = new URL(ENDPOINT);
  url.searchParams.set("ANOPROCESSO", String(year));
  const response = await fetch(url, {headers: {Accept: "application/json"}, signal: AbortSignal.timeout(timeoutMs)});
  if (!response.ok) throw new Error(`TCE-PE HTTP ${response.status}`);
  const json: unknown = await response.json();
  if (!json || typeof json !== "object" || !("resposta" in json)) throw new Error("Unexpected TCE-PE response");
  const envelope = (json as {resposta?: unknown}).resposta;
  if (!envelope || typeof envelope !== "object") throw new Error("Missing TCE-PE envelope");
  const data = envelope as Record<string, unknown>;
  if (String(data.status).toUpperCase() !== "OK") throw new Error(`TCE-PE API error: ${String(data.status)}`);
  if (!Array.isArray(data.conteudo)) throw new Error("Missing TCE-PE content array");
  const notices: TcePeNotice[] = [];
  const keys = new Set<string>();
  for (const entry of data.conteudo) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const key = field(row, "CODIGOPL") ?? [field(row,"CODIGOUG"),field(row,"ANOPROCESSO"),field(row,"NUMEROPROCESSO")].join("/");
    if (!key || keys.has(key)) continue;
    keys.add(key);
    const amount = Number(row.VALORORCAMENTOESTIMATIVO);
    notices.push({
      key, agency: field(row,"UG"), object: field(row,"OBJETOCONFORMEEDITAL") ?? field(row,"DESCRICAOOBJETO"),
      modality: field(row,"NOMEMODALIDADE"), situation: field(row,"SITUACAOLICITACAO"),
      sessionDate: field(row,"DATASESSAOABERTURA"), estimatedValue: Number.isFinite(amount) ? amount : null,
      documentUrl: field(row,"LinkArquivo"), raw: row,
    });
  }
  const limit = Number(data.limiteResultado ?? 10000);
  const count = Number(data.tamanhoResultado ?? notices.length);
  return {notices, count, truncated: notices.length >= limit || count >= limit, status: "read_only_preview", endpoint: url.toString()};
}
