/** Bounded XLSX preview for public exports. No macros, formulas or external references are executed. */
import { inflateRawSync } from "node:zlib";

function xmlText(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/&(?:amp|lt|gt|quot|apos|#(\d+)|#x([a-f\d]+));/gi, (entity, dec, hex) => {
    if (dec || hex) { const code = parseInt(dec ?? hex, dec ? 10 : 16); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ""; }
    return ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" } as Record<string,string>)[entity] ?? entity;
  }).trim();
}
function zipEntries(input: Uint8Array) {
  const bytes = Buffer.from(input);
  const entries = new Map<string, string>();
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("XLSX: diretório ZIP ausente.");
  const count = bytes.readUInt16LE(end + 10);
  if (count > 100) throw new Error("XLSX: arquivos internos demais.");
  let offset = bytes.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("XLSX: índice ZIP inválido.");
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20);
    const uncompressed = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extra = bytes.readUInt16LE(offset + 30);
    const comment = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extra + comment;
    if (!/^xl\/(?:sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(name)) continue;
    if (uncompressed > 8_000_000 || compressed > 2_000_000) throw new Error("XLSX: planilha excede o limite de segurança.");
    if (local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50) throw new Error("XLSX: cabeçalho ZIP inválido.");
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    if (start + compressed > bytes.length) throw new Error("XLSX: conteúdo ZIP incompleto.");
    const data = bytes.subarray(start, start + compressed);
    const result = method === 8 ? inflateRawSync(data, { maxOutputLength: 8_000_000 }) : method === 0 ? data : null;
    if (!result) throw new Error("XLSX: compressão não suportada.");
    entries.set(name, result.toString("utf8"));
  }
  return entries;
}
export function previewXlsx(input: Uint8Array) {
  const entries = zipEntries(input);
  const shared = [...(entries.get("xl/sharedStrings.xml") ?? "").matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m => xmlText(m[1]));
  const sheets = [...entries].filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort(([a],[b]) => a.localeCompare(b));
  if (!sheets.length) throw new Error("XLSX: nenhuma aba encontrada.");
  const xml = sheets[0][1];
  const rows: string[][] = [];
  for (const match of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cell of match[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+)\d+"/.exec(cell[1])?.[1];
      if (!ref) continue;
      let index = 0;
      for (const char of ref) index = index * 26 + char.charCodeAt(0) - 64;
      index--;
      if (index < 0 || index >= 100) continue;
      const body = cell[2] ?? "";
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? body;
      cells[index] = /\bt="s"/.test(cell[1]) ? (shared[Number(raw)] ?? "") : xmlText(raw);
    }
    if (cells.some(Boolean)) rows.push(cells);
    if (rows.length > 5000) break;
  }
  const headers = (rows[0] ?? []).map(v => v?.slice(0,120) ?? "");
  const find = (pattern: RegExp) => headers.findIndex(h => pattern.test(h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()));
  const id = find(/numero|identificador|codigo|processo/);
  const agency = find(/orgao|unidade gestora|secretaria/);
  const object = find(/objeto|descricao/);
  const situation = find(/situacao|status|fase|andamento/);
  const date = find(/data.*(abertura|sessao|proposta)|prazo.*(final|encerramento)/);
  const notices = rows.slice(1,31).map((row, i) => ({
    key: id >= 0 ? (row[id] ?? String(i+1)).slice(0,200) : String(i+1),
    agency: agency >= 0 ? (row[agency] ?? null) : null,
    object: object >= 0 ? (row[object] ?? null) : null,
    situation: situation >= 0 ? (row[situation] ?? null) : null,
  }));
  const statusCounts = { finalized: 0, failed: 0, revoked: 0, openCandidate: 0, unknown: 0 };
  for (const row of rows.slice(1)) {
    const status = situation >= 0 ? (row[situation] ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
    if (/homologad|finalizad|encerrad|concluid|adjudicad/.test(status)) statusCounts.finalized++;
    else if (/fracassad|desert/.test(status)) statusCounts.failed++;
    else if (/revogad|anulad|cancelad/.test(status)) statusCounts.revoked++;
    else if (/abert|recebendo proposta|em disputa|publicad/.test(status)) statusCounts.openCandidate++;
    else statusCounts.unknown++;
  }
  return { statusCounts, headers, totalExtracted: rows.length - 1, notices, schemaRecognized: id >= 0 && object >= 0, truncated: rows.length > 5000, fieldCoverage: { identifier: id >= 0, agency: agency >= 0, object: object >= 0, situation: situation >= 0, deadline: date >= 0 }, safeForPublication: false };
}
