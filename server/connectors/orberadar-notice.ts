import type { RadarCandidate } from "./orberadar";
export type RadarNotice = RadarCandidate & { object: string | null; procurementNumber: string | null; processNumber: string | null; sessionEvidence: string | null; deadlineEvidence: string | null; reviewReasons: string[] };
export function parseRadarNotice(candidate: RadarCandidate, plainText: string): RadarNotice {
  const text = plainText.replace(/\s+/g," ").trim();
  const field = (pattern: RegExp) => pattern.exec(text)?.[1]?.trim() || null;
  const object = field(/\bobjeto\s*:\s*(.{10,700}?)(?=\s+(?:informa[çc][õo]es|valor|data de|local|edital|in[ií]cio da sess[ãa]o)\b|$)/iu);
  const numbers = [...new Set([...text.matchAll(/\bpreg[ãa]o\s+(?:eletr[ôo]nico|presencial)\s*(?:n[º°o.]?\s*)?(\d+\s*\/\s*20\d{2})/giu)].map(m=>m[1].replace(/\s/g,"")))];
  const processNumber = field(/processo\s+(?:administrativo(?:\s+licitat[óo]rio)?|licitat[óo]rio)\s*(?:n[º°o.]?\s*)?(\d+\s*\/\s*20\d{2})/iu);
  const sessionEvidence = field(/((?:in[ií]cio da sess[ãa]o|data da sess[ãa]o|abertura da disputa)\s*[:–-]?\s*.{1,100})/iu);
  const deadlineEvidence = field(/((?:encerramento|prazo final|limite|t[eé]rmino)\s+(?:do recebimento|para recebimento|para envio|de envio)\s+(?:das |de )?propostas\s*[:–-]?\s*.{1,120})/iu);
  const reviewReasons = ["confirmar situação e prazo na origem", "confirmar autorização de coleta e reutilização"];
  if (!object) reviewReasons.push("objeto não identificado");
  if (numbers.length !== 1) reviewReasons.push("identificador ausente ou conflitante");
  if (!deadlineEvidence) reviewReasons.push("prazo de propostas não identificado");
  return {...candidate, object, procurementNumber: numbers.length === 1 ? numbers[0] : null, processNumber, sessionEvidence, deadlineEvidence, reviewReasons};
}
