import { TRPCError } from "@trpc/server";
import { getOpportunityDetail } from "./opportunities";
import { getDb } from "../db";
import { opportunities } from "../../drizzle/schema";
import { eq } from "drizzle-orm";


type AnalysisResult = {
  executiveSummary: string;
  object: string | null;
  modality: string | null;
  estimatedValue: string | null;
  proposalStartAt: string | null;\n  proposalDeadline: string | null;
  openingDate: string | null;
  sessionAt: string | null;
  judgmentCriterion: string | null;
  qualificationRequirements: string[];
  documentChecklist: string[];
  risks: string[];
  attentionPoints: string[];
  evidence: Array<{ topic: string; page: string | null; excerpt: string }>;
  missingInformation: string[];
  documentAnalyzed: boolean;
  documentName: string | null;
};

type PncpDateMetadata = {
  controlNumber: string | null;
  publicationAt: string | null;
  proposalReceiptStartsAt: string | null;
  proposalReceiptEndsAt: string | null;
};

function formatPncpBrazilDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  // PNCP date-time fields are local procurement times when no offset is supplied.
  const local = /^(\\d{4})-(\\d{2})-(\\d{2})[T ](\\d{2}):(\\d{2})(?::(\\d{2}))?$/.exec(raw);
  if (local) return `${local[3]}/${local[2]}/${local[1]} às ${local[4]}:${local[5]} (horário de Brasília)`;
  const dateOnly = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(raw);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(parsed) + " (horário de Brasília)";
  }
  return raw;
}

async function getPncpDateMetadata(opportunityId: string): Promise<PncpDateMetadata> {
  const [row] = await getDb().select({
    controlNumber: opportunities.controlNumber,
    rawData: opportunities.rawData,
  }).from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
  const rawData = row?.rawData && typeof row.rawData === "object"
    ? row.rawData as Record<string, unknown>
    : {};
  const raw = rawData.raw && typeof rawData.raw === "object"
    ? rawData.raw as Record<string, unknown>
    : rawData;
  return {
    controlNumber: row?.controlNumber ?? (typeof raw.numeroControlePNCP === "string" ? raw.numeroControlePNCP : null),
    publicationAt: formatPncpBrazilDate(raw.dataPublicacaoPncp),
    proposalReceiptStartsAt: formatPncpBrazilDate(raw.dataAberturaProposta ?? raw.dataAberturaPropostaPncp),
    proposalReceiptEndsAt: formatPncpBrazilDate(raw.dataEncerramentoProposta ?? raw.dataEncerramentoPropostaPncp),
  };
}

async function discoverPncpDocuments(opportunityId: string) {
  const [row] = await getDb().select({
    sourceKey: opportunities.sourceKey,
    controlNumber: opportunities.controlNumber,
    agencyCnpj: opportunities.agencyCnpj,
    year: opportunities.year,
    procurementNumber: opportunities.procurementNumber,
    rawData: opportunities.rawData,
  }).from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
  if (!row) return [];

  const rawData = row.rawData && typeof row.rawData === "object" ? row.rawData as Record<string, unknown> : {};
  const raw = rawData.raw && typeof rawData.raw === "object" ? rawData.raw as Record<string, unknown> : rawData;
  const organization = raw.orgaoEntidade && typeof raw.orgaoEntidade === "object" ? raw.orgaoEntidade as Record<string, unknown> : {};
  const sourceParts = row.sourceKey.split("/");
  const controlNumber = String(
    row.controlNumber || raw.numeroControlePNCP || raw.numeroControlePncp || raw.codigoControlePNCP || ""
  ).trim();
  // PNCP control number format: CNPJ-1-000050/2027. The last number is the
  // PNCP sequence, not necessarily the public notice/procurement number (e.g. 55/2027).
  const controlMatch = controlNumber.match(/^([A-Za-z0-9]{14})-\d+-(\d{1,})\/(\d{4})$/);
  const cnpj = String(
    controlMatch?.[1] || row.agencyCnpj || raw.orgaoEntidadeCnpj || organization.cnpj ||
    (sourceParts[0]?.replace(/[^A-Za-z0-9]/g, "").length === 14 ? sourceParts[0] : "")
  ).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const year = String(
    controlMatch?.[3] || raw.anoCompraPncp || raw.anoCompra || row.year ||
    (sourceParts.length >= 3 ? sourceParts[1] : "")
  );
  const sequential = String(
    controlMatch?.[2] || raw.sequencialCompraPncp || raw.sequencialCompra ||
    (sourceParts.length >= 3 ? sourceParts[2] : "")
  ).replace(/\D/g, "").replace(/^0+(?=\d)/, "");

  if (!/^[A-Z0-9]{14}$/.test(cnpj) || !/^\d{4}$/.test(year) || !/^\d+$/.test(sequential)) {
    console.warn("[edital-analysis] PNCP lookup skipped: missing or invalid procurement identifiers", {
      hasCnpj: Boolean(cnpj), year, hasSequential: Boolean(sequential), hasControlNumber: Boolean(controlNumber),
    });
    return [];
  }

  // The public attachment service is hosted under /api/pncp. Keep the
  // consultation path as a compatibility fallback for PNCP deployments.
  const path = "/v1/orgaos/" + encodeURIComponent(cnpj) + "/compras/" + year + "/" + sequential + "/arquivos";
  const endpoints = [
    "https://pncp.gov.br/api/pncp" + path,
    "https://pncp.gov.br/api/consulta" + path,
  ];
  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        console.warn("[edital-analysis] PNCP attachment endpoint returned HTTP", response.status);
        continue;
      }
      const payload = await response.json() as { documentos?: unknown } | unknown[];
      const documents = Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object" && Array.isArray((payload as { documentos?: unknown }).documentos)
          ? (payload as { documentos: unknown[] }).documentos
          : [];
      return documents.filter(item => item && typeof item === "object") as Record<string, unknown>[];
    } catch (error) {
      console.warn("[edital-analysis] PNCP document lookup unavailable", error instanceof Error ? error.message : "unknown");
    }
  }
  return [];
}

function getOfficialPdf(opportunity: NonNullable<Awaited<ReturnType<typeof getOpportunityDetail>>>, discovered: Record<string, unknown>[] = []) {
  const candidates = [
    ...discovered,
    ...(Array.isArray(opportunity.documents) ? opportunity.documents : []),
    { url: opportunity.noticeUrl, name: "Edital" },
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    const rawUrl = [record.url, record.uri, record.link, record.downloadUrl, record.href]
      .find(value => typeof value === "string" && value.trim());
    if (typeof rawUrl !== "string") continue;
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase();
      const officialHost = host === "gov.br" || host.endsWith(".gov.br");
      const documentType = String(record.tipoDocumentoNome ?? record.titulo ?? record.name ?? record.title ?? "").toLowerCase();
      const isPdf = /\.pdf$/i.test(parsed.pathname) ||
        String(record.mimeType ?? record.contentType ?? "").toLowerCase().includes("pdf") ||
        /edital|termo de referência|projeto básico|aviso de contratação/.test(documentType);
      if (parsed.protocol === "https:" && officialHost && isPdf) {
        return { url: parsed.toString(), name: String(record.name ?? record.title ?? "Edital oficial") };
      }
    } catch {
      // Ignore malformed document URLs supplied by external procurement sources.
    }
  }
  return null;
}

function parseAnalysis(content: unknown): AnalysisResult {
  const raw = typeof content === "string" ? content : "";
  const cleaned = raw.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "A IA retornou uma análise em formato inválido. Tente novamente." });
  }
  const strings = (key: string) => Array.isArray(value[key]) ? (value[key] as unknown[]).filter(item => typeof item === "string") as string[] : [];
  const evidence = Array.isArray(value.evidence) ? value.evidence.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.topic !== "string" || typeof row.excerpt !== "string") return [];
    return [{ topic: row.topic, page: typeof row.page === "string" ? row.page : null, excerpt: row.excerpt }];
  }) : [];
  const nullable = (key: string) => typeof value[key] === "string" && (value[key] as string).trim() ? (value[key] as string).trim() : null;
  return {
    executiveSummary: nullable("executiveSummary") ?? [
      nullable("object") ? `Objeto identificado: ${nullable("object")}.` : "",
      nullable("modality") ? `Modalidade: ${nullable("modality")}.` : "",
      nullable("estimatedValue") ? `Valor estimado: ${nullable("estimatedValue")}.` : "",
      "Resumo executivo não retornado pela IA; confira os campos e as evidências abaixo.",
    ].filter(Boolean).join(" "),
    object: nullable("object"),
    modality: nullable("modality"),
    estimatedValue: nullable("estimatedValue"),
    proposalStartAt: nullable("proposalStartAt"),\n    proposalDeadline: nullable("proposalDeadline"),
    openingDate: nullable("openingDate"),
    sessionAt: nullable("sessionAt"),
    judgmentCriterion: nullable("judgmentCriterion"),
    qualificationRequirements: strings("qualificationRequirements"),
    documentChecklist: strings("documentChecklist"),
    risks: strings("risks"),
    attentionPoints: strings("attentionPoints"),
    evidence,
    missingInformation: strings("missingInformation"),
    documentAnalyzed: value.documentAnalyzed === true,
    documentName: nullable("documentName"),
  };
}

export async function analyzeOpportunityEdital(opportunityId: string, userId: string) {
  const opportunity = await getOpportunityDetail(opportunityId, userId);
  if (!opportunity) throw new TRPCError({ code: "NOT_FOUND", message: "A oportunidade não foi encontrada." });

  // Compras.gov.br republishes PNCP procurement records. Its source key may be an
  // internal idCompra, so discover the official PNCP attachment list from raw metadata too.
  const discoveredDocuments = ["pncp", "compras.gov.br"].includes(opportunity.sourceCode)
    ? await discoverPncpDocuments(opportunityId)
    : [];
  const pdf = getOfficialPdf(opportunity, discoveredDocuments);
  const metadata = {
    title: opportunity.title,
    description: opportunity.description,
    agency: opportunity.agencyName,
    unit: opportunity.unitName,
    modality: opportunity.modality,
    processNumber: opportunity.processNumber,
    estimatedValue: opportunity.estimatedValue,
    proposalDeadline: opportunity.proposalDeadline,
    openingDate: opportunity.openingDate,
    sessionAt: opportunity.sessionAt,
    judgmentCriterion: opportunity.judgmentCriterion,
    disputeMode: opportunity.disputeMode,
    items: opportunity.items.slice(0, 100).map(item => ({
      number: item.itemNumber,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      estimatedValue: item.estimatedTotalValue,
    })),
  };


  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const parts: Array<Record<string, unknown>> = [{
      text: "Analise esta oportunidade e, se anexado, o edital oficial. Metadados estruturados (não equivalem à leitura do edital):\\n" + JSON.stringify(metadata),
    }];

    if (pdf) {
      const pdfResponse = await fetch(pdf.url, {
        headers: { Accept: "application/pdf" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!pdfResponse.ok) throw new Error(`Official PDF download failed: HTTP ${pdfResponse.status}`);
      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      const maxPdfBytes = 40 * 1024 * 1024;
      if (pdfBuffer.length > maxPdfBytes) throw new Error("Official PDF exceeds the 40 MB inline processing limit");
      if (pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
        throw new Error("The official document URL did not return a valid PDF");
      }
      parts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBuffer.toString("base64"),
        },
      });
    }

    const systemInstruction = "Você é um analista técnico de licitações públicas brasileiras. Analise exclusivamente o conteúdo fornecido. Não invente datas, valores, documentos, páginas, artigos ou exigências. Diferencie informação encontrada no documento de metadados da oportunidade. REGRA CRÍTICA DE DATAS: em pncpOfficialDates, publicationAt é a divulgação no PNCP; proposalReceiptStartsAt é o INÍCIO do recebimento de propostas; proposalReceiptEndsAt é o FIM do recebimento de propostas. O fim do recebimento não é o início, e nenhum desses campos deve ser confundido automaticamente com a sessão pública. Compare somente eventos equivalentes: início com início, fim com fim e sessão pública com sessão pública. Nunca compare o início do recebimento com a data da sessão para declarar divergência. Se o fim do recebimento e a sessão pública tiverem a mesma data e hora, trate como consistentes. Quando pncpOfficialDates trouxer datas, use-as como fonte estruturada prioritária para os campos proposalStartAt e proposalDeadline; preserve o horário de Brasília indicado e não aplique deslocamento UTC. openingDate deve representar somente a data de abertura indicada no documento, e sessionAt somente a sessão pública. Se houver divergência real entre o mesmo evento nos metadados e no edital, registre ambos em attentionPoints e missingInformation. Se não localizar algo, use null ou lista vazia e inclua em missingInformation. Datas sem fuso devem ser reproduzidas como aparecem. Aponte riscos como pontos para revisão humana, nunca como conclusão jurídica. Para cada evidência, forneça página somente se estiver visível e um trecho curto fiel ao documento. Responda apenas JSON válido com as chaves: executiveSummary, object, modality, estimatedValue, proposalStartAt, proposalDeadline, openingDate, sessionAt, judgmentCriterion, qualificationRequirements, documentChecklist, risks, attentionPoints, evidence (objetos topic,page,excerpt), missingInformation, documentAnalyzed, documentName. Se nenhum PDF foi anexado, deixe documentAnalyzed=false e explique a limitação em missingInformation. Não trate metadados como se fossem conteúdo lido do edital.";

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 3500,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok) {
      const providerError = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(`Gemini API failed with HTTP ${response.status}: ${providerError?.error?.message || "provider request rejected"}`);
    }

    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const answer = payload.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("") || "";
    const analysis = parseAnalysis(answer);
    if (pdf) {
      analysis.documentAnalyzed = true;
      analysis.documentName = analysis.documentName ?? pdf.name;
    }
    return {
      opportunityId,
      generatedAt: new Date().toISOString(),
      source: opportunity.sourceName,
      sourceUrl: opportunity.noticeUrl ?? opportunity.sourceUrl,
      analysis,
    };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    console.error("[edital-analysis] failed", error instanceof Error ? error.message : "unknown");
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível analisar o edital agora. Confira se o documento oficial está acessível e tente novamente." });
  }
}
