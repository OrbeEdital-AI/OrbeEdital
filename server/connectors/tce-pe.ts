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
export async function probeTcePe(year: number, timeoutMs = 22000): Promise<{
  notices: TcePeNotice[]; count: number; truncated: boolean; status: string; endpoint: string;
}> {
  if (!Number.isInteger(year) || year < 2011 || year > new Date().getFullYear() + 1) throw new Error("Invalid year");
  const url = new URL(ENDPOINT);
  // ANOPROCESSO is an output-only field for LicitacaoUG; ANOMODALIDADE is documented as an input filter.
  url.searchParams.set("ANOMODALIDADE", String(year));
  // Keep the total request bounded by the serverless execution window.
  // A transient upstream timeout gets one retry, with a shared deadline.
  const deadline = Date.now() + timeoutMs;
  const startedAt = Date.now();
  let lastFailure = "sem resposta";
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 1000) break;
    try {
      response = await fetch(url, {
        headers: {Accept: "application/json", "Accept-Encoding": "gzip, deflate"},
        signal: AbortSignal.timeout(remaining),
        cache: "no-store",
      });
      if (response.status >= 500 && attempt === 0) { lastFailure = `HTTP ${response.status}`; await response.body?.cancel(); continue; }
      break;
    } catch (error) {
      const isTimeout = error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError" || /timeout|aborted/i.test(error.message));
      if (!isTimeout) {
        const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        throw new Error(`TCE-PE: falha de conexão antes de receber dados (${reason}).`);
      }
      lastFailure = error instanceof Error ? error.name : "timeout";
      if (attempt === 1 || deadline - Date.now() < 1000) {
        throw new Error(`TCE-PE: nenhum cabeçalho recebido em ${Date.now() - startedAt} ms (${lastFailure}). Possível bloqueio de rede ou indisponibilidade da origem; não é possível confirmar a causa somente pelo timeout.`);
      }
    }
  }
  if (!response) throw new Error(`TCE-PE: sem resposta HTTP após ${Date.now() - startedAt} ms (${lastFailure}).`);
  if (!response.ok) throw new Error(`TCE-PE HTTP ${response.status}`);
  // Parsing/transfer can also stall even after headers arrive. Keep a separate bounded deadline.
  const remainingForBody = deadline - Date.now();
  if (remainingForBody < 1000) throw new Error(`TCE-PE: cabeçalhos recebidos (HTTP ${response.status}), mas não restou tempo para transferir os dados.`);
  let json: unknown;
  try {
    json = await Promise.race([
      response.json(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("body_timeout")), remainingForBody)),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === "body_timeout") {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`TCE-PE: conexão estabelecida (HTTP ${response.status}), mas a transferência dos dados excedeu ${timeoutMs} ms.`);
    }
    throw error;
  }
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
