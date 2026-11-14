import { TRPCError } from "@trpc/server";
import { getOpportunityDetail } from "./opportunities";
import { invokeLLM, type Message } from "../_core/llm";

type AnalysisResult = {
  executiveSummary: string;
  object: string | null;
  modality: string | null;
  estimatedValue: string | null;
  proposalDeadline: string | null;
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

function getOfficialPdf(opportunity: NonNullable<Awaited<ReturnType<typeof getOpportunityDetail>>>) {
  const candidates = [
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
      const isPdf = /\.pdf$/i.test(parsed.pathname) ||
        String(record.mimeType ?? record.contentType ?? "").toLowerCase().includes("pdf");
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
    executiveSummary: nullable("executiveSummary") ?? "A IA não conseguiu produzir um resumo confiável.",
    object: nullable("object"),
    modality: nullable("modality"),
    estimatedValue: nullable("estimatedValue"),
    proposalDeadline: nullable("proposalDeadline"),
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

  const pdf = getOfficialPdf(opportunity);
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

  const messages: Message[] = [
    {
      role: "system",
      content: "Você é um analista técnico de licitações públicas brasileiras. Analise exclusivamente o conteúdo fornecido. Não invente datas, valores, documentos, páginas, artigos ou exigências. Diferencie informação encontrada no documento de metadados da oportunidade. Se não localizar algo, use null ou lista vazia e inclua em missingInformation. Datas devem ser reproduzidas como aparecem, sem inferir fuso ou horário. Aponte riscos como pontos para revisão humana, nunca como conclusão jurídica. Para cada evidência, forneça página somente se estiver visível e um trecho curto fiel ao documento. Responda apenas JSON válido com as chaves: executiveSummary, object, modality, estimatedValue, proposalDeadline, openingDate, sessionAt, judgmentCriterion, qualificationRequirements, documentChecklist, risks, attentionPoints, evidence (objetos topic,page,excerpt), missingInformation, documentAnalyzed, documentName. Se nenhum PDF foi anexado, deixe documentAnalyzed=false e explique a limitação em missingInformation. Não trate metadados como se fossem conteúdo lido do edital."
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Analise esta oportunidade e, se anexado, o edital oficial. Metadados estruturados (não equivalem à leitura do edital):\n" + JSON.stringify(metadata) },
        ...(pdf ? [{ type: "file_url" as const, file_url: { url: pdf.url, mime_type: "application/pdf" as const } }] : []),
      ],
    },
  ];

  try {
    const response = await invokeLLM({ messages, responseFormat: { type: "json_object" }, maxTokens: 3500 });
    const answer = response.choices?.[0]?.message?.content;
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
