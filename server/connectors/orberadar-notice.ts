import type { RadarCandidate } from "./orberadar";
export type RadarNotice = RadarCandidate & { object: string | null; modality: string | null; procurementNumber: string | null; processNumber: string | null; sessionEvidence: string | null; deadlineEvidence: string | null; reviewReasons: string[] };
export function parseRadarNotice(candidate: RadarCandidate, plainText: string): RadarNotice {
 const text = plainText.normalize("NFKC").replace(/\s+/g," ").trim();
 const field = (pattern: RegExp) => pattern.exec(text)?.[1]?.trim() || null;
 const object = field(/\bobjeto\s*[:–-]\s*(.{10,900}?)(?=\s+(?:informa[çc][õo]es|valor|data de|local|edital|in[ií]cio da sess[ãa]o|recebimento das propostas)\b|$)/iu);
 const matches = [...(candidate.title+" "+text).normalize("NFKC").matchAll(/\b(preg[ãa]o(?:\s+(?:eletr[ôo]nico|presencial))?|concorr[êe]ncia(?:\s+(?:eletr[ôo]nica|presencial))?|dispensa(?:\s+eletr[ôo]nica)?)\s*(?:[-–:]\s*)?(?:SRP\s*)?(?:n(?:[º°o.]|\s)*\s*)?(\d+\s*\/\s*20\d{2})/giu)];
 const numbers = [...new Set(matches.map(m=>m[2].replace(/\s/g,"")))];
 const processNumber = field(/\bprocesso(?:\s+(?:administrativo|licitat[óo]rio|de licita[çc][ãa]o)){0,2}\s*[:–-]?\s*(?:n[º°o.]*\s*)?(\d+\s*\/\s*20\d{2})/iu);
 const sessionEvidence = field(/((?:in[ií]cio da sess[ãa]o|data da sess[ãa]o|abertura da disputa|abertura das propostas)\s*[:–-]?\s*.{1,100})/iu);
 const deadlineEvidence = field(/((?:(?:encerramento|prazo final|limite|t[eé]rmino|fim)\s+(?:do recebimento|para recebimento|para envio|de envio|de recebimento)\s+(?:das |de )?propostas|(?:recebimento|envio|entrega|acolhimento)\s+(?:das |de )?propostas\s*(?:at[eé]|se encerra|final)|(?:data|hor[aá]rio)\s+limite\s+(?:para\s+)?(?:recebimento|envio)\s+(?:das |de )?propostas)\s*[:–-]?\s*.{1,120})/iu);
 const reviewReasons = ["confirmar situação e prazo na origem","confirmar autorização de coleta e reutilização"];
 if (!object) reviewReasons.push("objeto não identificado");
 if (numbers.length !== 1) reviewReasons.push("identificador ausente ou conflitante");
 if (!deadlineEvidence) reviewReasons.push("prazo de propostas não identificado");
 return {...candidate, object, modality: numbers.length===1 ? matches[0][1] : null, procurementNumber:numbers.length===1?numbers[0]:null, processNumber, sessionEvidence, deadlineEvidence, reviewReasons};
}
