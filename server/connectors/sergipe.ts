import { previewXlsx } from "./xlsx-preview";
/** Experimental Sergipe transparency API probe. Admin only, no database writes. */
const ENDPOINT = "https://portal.cge.se.gov.br/secc/api/transparencia/export/licitacoes";
export async function probeSergipe(timeoutMs = 18000) {
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      headers: { Accept: "application/json, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new Error(`Sergipe: conexão não concluída em ${Date.now() - startedAt} ms (${message}).`);
  }
  if (!response.ok) throw new Error(`Sergipe: servidor respondeu HTTP ${response.status} em ${Date.now() - startedAt} ms.`);
  const type = response.headers.get("content-type") ?? "";
  const isExcel = /spreadsheetml|excel|octet-stream/i.test(type);
  const isCsv = /csv/i.test(type);
  if (!isExcel && !isCsv && !type.toLowerCase().includes("json")) throw new Error(`Sergipe: formato não suportado (tipo: ${type || "não informado"}).`);
  // Read only a bounded preview to avoid exhausting serverless memory.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Sergipe: resposta sem corpo.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (bytes < 2_000_000) {
      const remaining = timeoutMs - (Date.now() - startedAt);
      if (remaining <= 0) throw new Error("tempo de transferência excedido");
      const result = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("tempo de transferência excedido")), remaining)),
      ]);
      if (result.done) break;
      chunks.push(result.value);
      bytes += result.value.byteLength;
    }
    if (bytes >= 2_000_000) {
      return { status: "preview_limit", httpStatus: response.status, elapsedMs: Date.now() - startedAt, bytesRead: bytes, totalExtracted: null, displayed: 0, notices: [], warning: "A API respondeu, mas o arquivo ultrapassou o limite de 2 MB do teste. É necessária coleta paginada ou por arquivo." };
    }
  } catch (error) {
    throw new Error(`Sergipe: conexão HTTP ${response.status} estabelecida, mas ${error instanceof Error ? error.message : "falhou a leitura"}.`);
  } finally {
    void reader.cancel().catch(() => undefined);
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  if (isExcel) {
    try {
      const preview = previewXlsx(buffer);
      return { status: preview.schemaRecognized ? "xlsx_preview" : "xlsx_schema_review", httpStatus: response.status, elapsedMs: Date.now() - startedAt, bytesRead: bytes, totalExtracted: preview.totalExtracted, displayed: preview.notices.length, notices: preview.notices, warning: preview.schemaRecognized ? "Prévia administrativa extraída do XLSX. Nenhuma licitação foi importada; situação e prazo ainda exigem validação." : `XLSX lido, mas colunas ainda não reconhecidas: ${preview.headers.slice(0,12).join(", ")}. Nenhuma licitação foi importada.` };
    } catch (error) {
      return { status: "xlsx_parse_error", httpStatus: response.status, elapsedMs: Date.now() - startedAt, bytesRead: bytes, totalExtracted: null, displayed: 0, notices: [], warning: `XLSX recebido, mas não foi possível interpretar a planilha: ${error instanceof Error ? error.message : "formato inesperado"}.` };
    }
  }
  if (isCsv) {
    const lines = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    const separator = (lines[0]?.match(/;/g)?.length ?? 0) > (lines[0]?.match(/,/g)?.length ?? 0) ? ";" : ",";
    return { status: "csv_detected", httpStatus: response.status, elapsedMs: Date.now() - startedAt, bytesRead: bytes, totalExtracted: Math.max(0, lines.length - 1), displayed: 0, notices: [], warning: `CSV detectado (separador ${separator}; colunas: ${(lines[0] ?? "").slice(0, 180)}). É necessário validar o esquema antes da importação.` };
  }
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder().decode(buffer)); }
  catch { throw new Error("Sergipe: resposta recebida, mas JSON inválido."); }
  const obj = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
  const records = Array.isArray(payload) ? payload :
    [obj?.data, obj?.dados, obj?.results, obj?.resultado, obj?.licitacoes, obj?.content].find(Array.isArray);
  if (!Array.isArray(records)) {
    return { status: "unknown_schema", httpStatus: response.status, elapsedMs: Date.now() - startedAt, bytesRead: bytes, totalExtracted: null, displayed: 0, notices: [], warning: `JSON recebido; formato ainda não reconhecido. Campos: ${Object.keys(obj ?? {}).slice(0, 12).join(", ") || "nenhum"}` };
  }
  const notices = records.slice(0, 30).map((entry, index) => {
    const row = entry && typeof entry === "object" && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
    const read = (...keys: string[]) => {
      const key = keys.find(key => row[key] !== undefined && row[key] !== null);
      return key ? String(row[key]).slice(0, 500) : null;
    };
    return { key: read("id", "codigo", "numero", "numeroLicitacao", "numero_licitacao") ?? String(index + 1),
      agency: read("orgao", "unidadeGestora", "unidade_gestora", "nomeOrgao"),
      object: read("objeto", "descricao", "descricaoObjeto"), situation: read("situacao", "status") };
  });
  return { status: "read_only_preview", httpStatus: response.status, elapsedMs: Date.now() - startedAt, bytesRead: bytes, totalExtracted: records.length, displayed: notices.length, notices, warning: records.length ? null : "A API respondeu sem registros no formato reconhecido." };
}
