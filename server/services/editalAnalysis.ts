import { TRPCError } from "@trpc/server";
import { getOpportunityDetail } from "./opportunities";
import { getDb } from "../db";
import { auditLogs, companyMembers, opportunities } from "../../drizzle/schema";
import { eq } from "drizzle-orm";


type AnalysisResult = {
  executiveSummary: string;
  object: string | null;
  modality: string | null;
  estimatedValue: string | null;
  proposalStartAt: string | null;
  proposalDeadline: string | null;
  openingDate: string | null;
  sessionAt: string | null;
  judgmentCriterion: string | null;
  qualificationRequirements: string[];
  documentChecklist: string[];
  risks: string[];
  attentionPoints: string[];
  evidence: Array<{ topic: string; page: string | null; excerpt: string; document: string | null }>;
  missingInformation: string[];
  documentAnalyzed: boolean;
  documentName: string | null;
  documentsAnalyzed: string[];
  documentsNotProcessed: string[];
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
  const local = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (local) return `${local[3]}/${local[2]}/${local[1]} às ${local[4]}:${local[5]} (horário de Brasília)`;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
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

async function logAnalysisAudit(userId: string, opportunityId: string, action: string, details: Record<string, unknown>) {
  try {
    const db = getDb();
    const [membership] = await db.select({ companyId: companyMembers.companyId })
      .from(companyMembers).where(eq(companyMembers.userId, userId)).limit(1);
    await db.insert(auditLogs).values({
      actorUserId: userId,
      companyId: membership?.companyId ?? null,
      action,
      entityType: "opportunity",
      entityId: opportunityId,
      details,
    });
  } catch (error) {
    console.warn("[edital-analysis] audit log could not be saved", error instanceof Error ? error.message : "unknown");
  }
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
  const controlMatch = controlNumber.match(/^([A-Za-z0-9]{14})-\d+-(\d{1,})\/(\d{4})$/);
  const cnpj = String(
    controlMatch?.[1] || row.agencyCnpj || raw.orgaoEntidadeCnpj || organization.cnpj ||
    (sourceParts[0]?.replace(/[^A-Za-z0-9]/g, "").length === 14 ? sourceParts[0] : "")
  ).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const year = String(
    controlMatch?.[3] || raw.anoCompraPncp || raw.anoCompra || row.year ||
    (sourceParts.length >= 3 ? sourceParts[1] : "")
  );
  // Prefer the official PNCP sequence in the control number or raw metadata.
  // Never substitute procurementNumber: it can be the public notice number.
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

  const procurementPath = "/v1/orgaos/" + encodeURIComponent(cnpj) + "/compras/" + year + "/" + sequential;
  const listUrl = "https://pncp.gov.br/api/pncp" + procurementPath + "/arquivos";
  const downloadBase = "https://pncp.gov.br/api/pncp" + procurementPath + "/arquivos/";
  try {
    const response = await fetch(listUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.warn("[edital-analysis] PNCP attachment list returned HTTP", response.status);
      return [];
    }
    const payload = await response.json() as unknown;
    const found: Record<string, unknown>[] = [];
    const visited = new Set<unknown>();
    const walk = (node: unknown, depth = 0) => {
      if (!node || typeof node !== "object" || visited.has(node) || depth > 7) return;
      visited.add(node);
      if (Array.isArray(node)) {
        for (const item of node) walk(item, depth + 1);
        return;
      }
      const record = node as Record<string, unknown>;
      const documentId = record.sequencialDocumento ?? record.sequencialDocumentoPncp ?? record.idDocumento;
      const hasDocumentUrl = [record.url, record.uri, record.link, record.downloadUrl, record.href, record.urlArquivo, record._downloadUrl]
        .some(value => typeof value === "string" && value.trim());
      const looksLikeDocument = documentId !== undefined || hasDocumentUrl ||
        (typeof record.tipoDocumentoNome === "string" && Boolean(record.titulo || record.nomeArquivo));
      if (looksLikeDocument) {
        const normalizedId = String(documentId ?? "").replace(/\D/g, "");
        found.push({
          ...record,
          ...(normalizedId ? { _downloadUrl: downloadBase + encodeURIComponent(normalizedId) } : {}),
        });
      }
      for (const key of ["documentos", "arquivos", "data", "content", "resultado", "result", "items", "results", "dados"]) {
        if (record[key] && typeof record[key] === "object") walk(record[key], depth + 1);
      }
    };
    walk(payload);
    return found;
  } catch (error) {
    console.warn("[edital-analysis] PNCP document lookup unavailable", error instanceof Error ? error.message : "unknown");
    return [];
  }
}

function getOfficialPdfs(
  opportunity: NonNullable<Awaited<ReturnType<typeof getOpportunityDetail>>>,
  discovered: Record<string, unknown>[] = [],
) {
  const candidates = [
    ...discovered,
    ...(Array.isArray(opportunity.documents) ? opportunity.documents : []),
    { url: opportunity.noticeUrl, name: "Edital" },
  ];
  const seen = new Set<string>();
  const documents: Array<{ url: string; name: string; kind: string }> = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    const rawUrl = [record._downloadUrl, record.downloadUrl, record.urlArquivo, record.url, record.uri, record.link, record.href]
      .find(value => {
        if (typeof value !== "string" || !value.trim()) return false;
        try {
          const candidate = new URL(value);
          const host = candidate.hostname.toLowerCase();
          return candidate.protocol === "https:" && (host === "gov.br" || host.endsWith(".gov.br"));
        } catch {
          return false;
        }
      });
    if (typeof rawUrl !== "string") continue;
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase();
      const officialHost = host === "gov.br" || host.endsWith(".gov.br");
      const name = [record.tipoDocumentoNome, record.titulo, record.name, record.title, record.nomeArquivo]
        .find(value => typeof value === "string" && value.trim())?.toString() ?? "Documento oficial";
      const documentType = [
        record.tipoDocumentoNome, record.titulo, record.name, record.title, record.nomeArquivo, record.extensao, record.tipoArquivo,
      ].filter(value => typeof value === "string").join(" ").toLocaleLowerCase("pt-BR");
      const mime = String(record.mimeType ?? record.contentType ?? record.tipoArquivo ?? record.extensao ?? "").toLowerCase();
      const relevantType = /edital|termo de referência|termo de refer[eê]ncia|projeto básico|anexo|retifica|esclarecimento|aviso|minuta|planilha|modelo|estudo técnico|memorial|proposta|impugna/i.test(documentType);
      const isPdf = /\.pdf$/i.test(parsed.pathname) || /\bpdf\b/i.test(documentType) || mime.includes("pdf") || relevantType;
      if (parsed.protocol !== "https:" || !officialHost || !isPdf) continue;
      const url = parsed.toString();
      if (seen.has(url)) continue;
      seen.add(url);
      const kind = /retifica|esclarecimento|impugna/i.test(documentType) ? "retificação/esclarecimento"
        : /termo de referência|projeto básico|estudo técnico/i.test(documentType) ? "referência técnica"
        : /anexo|planilha|modelo|memorial|proposta/i.test(documentType) ? "anexo"
        : /edital|aviso|minuta/i.test(documentType) ? "edital/aviso" : "anexo/documento complementar";
      documents.push({ url, name, kind });
    } catch {
      // Ignore malformed document URLs supplied by external procurement sources.
    }
  }
  const priority = (kind: string) => kind === "retificação/esclarecimento" ? 0
    : kind === "edital/aviso" ? 1 : kind === "referência técnica" ? 2 : 3;
  return documents.sort((a, b) => priority(a.kind) - priority(b.kind));
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
    return [{ topic: row.topic, page: typeof row.page === "string" ? row.page : null, excerpt: row.excerpt, document: typeof row.document === "string" ? row.document : null }];
  }) : [];
  const nullable = (key: string) => typeof value[key] === "string" && (value[key] as string).trim() ? (value[key] as string).trim() : null;
  return {
    executiveSummary: nullable("executiveSummary") ?? [
      nullable("object") ? `Objeto: ${nullable("object")}.` : "",
      nullable("modality") ? `Modalidade: ${nullable("modality")}.` : "",
      nullable("judgmentCriterion") ? `Critério de julgamento: ${nullable("judgmentCriterion")}.` : "",
      nullable("estimatedValue") ? `Valor estimado: ${nullable("estimatedValue")}.` : "",
      nullable("proposalStartAt") ? `Recebimento de propostas a partir de ${nullable("proposalStartAt")}.` : "",
      nullable("proposalDeadline") ? `Prazo final para propostas: ${nullable("proposalDeadline")}.` : "",
      nullable("sessionAt") ? `Sessão pública: ${nullable("sessionAt")}.` : "",
    ].filter(Boolean).join(" "),
    object: nullable("object"),
    modality: nullable("modality"),
    estimatedValue: nullable("estimatedValue"),
    proposalStartAt: nullable("proposalStartAt"),
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
    documentsAnalyzed: strings("documentsAnalyzed"),
    documentsNotProcessed: strings("documentsNotProcessed"),
  };
}

export async function analyzeOpportunityEdital(opportunityId: string, userId: string) {
  const startedAt = Date.now();
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  let documentSizeBytes = 0;
  let documentsAnalyzed: string[] = [];
  let documentsNotProcessed: string[] = [];
  let tokenUsage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } = {};
  const opportunity = await getOpportunityDetail(opportunityId, userId);
  if (!opportunity) throw new TRPCError({ code: "NOT_FOUND", message: "A oportunidade não foi encontrada." });

  // Compras.gov.br republishes PNCP procurement records. Its source key may be an
  // internal idCompra, so discover the official PNCP attachment list from raw metadata too.
  const discoveredDocuments = ["pncp", "compras.gov.br"].includes(opportunity.sourceCode)
    ? await discoverPncpDocuments(opportunityId)
    : [];
  const pdfs = getOfficialPdfs(opportunity, discoveredDocuments);
  const pncpDates = ["pncp", "compras.gov.br"].includes(opportunity.sourceCode)
    ? await getPncpDateMetadata(opportunityId)
    : null;
  const metadata = {
    title: opportunity.title,
    description: opportunity.description,
    agency: opportunity.agencyName,
    unit: opportunity.unitName,
    modality: opportunity.modality,
    processNumber: opportunity.processNumber,
    estimatedValue: opportunity.estimatedValue,
    pncpOfficialDates: pncpDates,
    // openingDate is intentionally omitted: legacy imports may map proposal start into this field.
    proposalDeadline: pncpDates?.proposalReceiptEndsAt ?? opportunity.proposalDeadline,
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

    const parts: Array<Record<string, unknown>> = [{
      text: "Analise esta oportunidade e todos os documentos PDF oficiais anexados nesta solicitação. Metadados estruturados não equivalem à leitura do edital. Cada arquivo será identificado pelo nome e tipo; cite a página e o documento de origem nas evidências.\\n" + JSON.stringify({ metadata, documentosOficiaisLocalizados: pdfs.map(doc => ({ nome: doc.name, tipo: doc.kind })) }),
    }];

    const maxAggregateBytes = 40 * 1024 * 1024;
    for (const document of pdfs.slice(0, 4)) {
      try {
        const pdfResponse = await fetch(document.url, {
          headers: { Accept: "application/pdf" },
          signal: AbortSignal.timeout(12_000),
        });
        if (!pdfResponse.ok) {
          documentsNotProcessed.push(document.name + " (download HTTP " + pdfResponse.status + ")");
          continue;
        }
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
        if (pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
          documentsNotProcessed.push(document.name + " (arquivo não é um PDF válido)");
          continue;
        }
        if (documentSizeBytes + pdfBuffer.length > maxAggregateBytes) {
          documentsNotProcessed.push(document.name + " (limite total de 40 MB por análise atingido)");
          continue;
        }
        documentSizeBytes += pdfBuffer.length;
        documentsAnalyzed.push(document.name);
        parts.push({
          text: "Documento oficial: " + document.name + ". Categoria: " + document.kind + ".",
        });
        parts.push({
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBuffer.toString("base64"),
          },
        });
      } catch (error) {
        documentsNotProcessed.push(document.name + " (falha ao baixar: " + (error instanceof Error ? error.message : "erro desconhecido") + ")");
      }
    }
    if (pdfs.length > 4) documentsNotProcessed.push(`${pdfs.length - 4} documento(s) adicionais não processados nesta análise rápida`);
    if (pdfs.length && !documentsAnalyzed.length) {
      documentsNotProcessed.push("Nenhum PDF oficial pôde ser baixado e validado; análise restrita aos metadados disponíveis");
    }

    const systemInstruction = "Você é um analista técnico de licitações públicas brasileiras. Analise exclusivamente o conteúdo fornecido. Não invente datas, valores, documentos, páginas, artigos ou exigências. Diferencie informação encontrada no documento de metadados da oportunidade. REGRA CRÍTICA DE DATAS: em pncpOfficialDates, publicationAt é a divulgação no PNCP; proposalReceiptStartsAt é o INÍCIO do recebimento de propostas; proposalReceiptEndsAt é o FIM do recebimento de propostas. O fim do recebimento não é o início, e nenhum desses campos deve ser confundido automaticamente com a sessão pública. Compare somente eventos equivalentes: início com início, fim com fim e sessão pública com sessão pública. Nunca compare o início do recebimento com a data da sessão para declarar divergência. Se o fim do recebimento e a sessão pública tiverem a mesma data e hora, trate como consistentes. Quando pncpOfficialDates trouxer datas, use-as como fonte estruturada prioritária para os campos proposalStartAt e proposalDeadline; preserve o horário de Brasília indicado e não aplique deslocamento UTC. openingDate deve representar somente a data de abertura indicada no documento, e sessionAt somente a sessão pública. Se houver divergência real entre o mesmo evento nos metadados e no edital, registre ambos em attentionPoints e missingInformation. Se não localizar algo, use null ou lista vazia e inclua em missingInformation. Datas sem fuso devem ser reproduzidas como aparecem. Aponte riscos como pontos para revisão humana, nunca como conclusão jurídica. Para cada evidência, forneça o nome do documento de origem, página somente se estiver visível e um trecho curto fiel ao documento. Responda apenas JSON válido com as chaves: executiveSummary, object, modality, estimatedValue, proposalStartAt, proposalDeadline, openingDate, sessionAt, judgmentCriterion, qualificationRequirements, documentChecklist, risks, attentionPoints, evidence (objetos topic,page,excerpt,document), missingInformation, documentAnalyzed, documentName. Se nenhum PDF foi anexado, deixe documentAnalyzed=false e explique a limitação em missingInformation. Não trate metadados como se fossem conteúdo lido do edital.";

    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: "user", parts }],
            generationConfig: { responseMimeType: "application/json", maxOutputTokens: 3500 },
          }),
          signal: AbortSignal.timeout(35_000),
        });
      } catch (error) {
        if (attempt === 0) continue;
        throw new TRPCError({ code: "GATEWAY_TIMEOUT", message: "A análise demorou mais que o esperado. O serviço de IA está lento; tente novamente em instantes." });
      }
      if (response.ok) break;
      if ((response.status === 429 || response.status === 503) && attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 1200));
        continue;
      }
      const providerError = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (response.status === 429 || response.status === 503) {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "O serviço de IA está temporariamente sobrecarregado. Aguarde um momento e tente novamente." });
      }
      throw new Error(`Gemini API failed with HTTP ${response.status}: ${providerError?.error?.message || "provider request rejected"}`);
    }
    if (!response?.ok) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "O serviço de IA não respondeu. Tente novamente em instantes." });

    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };
    tokenUsage = payload.usageMetadata ?? {};
    const answer = payload.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("") || "";
    const analysis = parseAnalysis(answer);
    if (pncpDates?.proposalReceiptStartsAt) analysis.proposalStartAt = pncpDates.proposalReceiptStartsAt;
    if (pncpDates?.proposalReceiptEndsAt) analysis.proposalDeadline = pncpDates.proposalReceiptEndsAt;
    // Do not let a legacy openingDate value (often the proposal-receipt start) be reported as a conflict with the public session.
    analysis.attentionPoints = analysis.attentionPoints.filter(point => {
      const normalized = point.toLocaleLowerCase("pt-BR");
      return !normalized.includes("metadados indicam abertura")
        && !normalized.includes("openingdate dos metadados")
        && !normalized.includes("divergência de data de abertura/proposta");
    });
    analysis.missingInformation = analysis.missingInformation.filter(point => {
      const normalized = point.toLocaleLowerCase("pt-BR");
      return !normalized.includes("openingdate dos metadados")
        && !normalized.includes("divergência detectada entre a openingdate");
    });
    if (pncpDates?.proposalReceiptStartsAt && pncpDates?.proposalReceiptEndsAt) {
      analysis.missingInformation = analysis.missingInformation.filter(point =>
        !/diverg[eê]ncia.*(proposta|abertura)/i.test(point)
      );
    }
    analysis.documentsAnalyzed = documentsAnalyzed;
    analysis.documentsNotProcessed = documentsNotProcessed;
    analysis.documentAnalyzed = documentsAnalyzed.length > 0;
    analysis.documentName = documentsAnalyzed.length ? documentsAnalyzed.join("; ") : null;
    if (!documentsAnalyzed.length) {
      analysis.missingInformation.push("Nenhum PDF oficial foi efetivamente processado; a análise se limita aos metadados disponíveis.");
    }
    if (documentsNotProcessed.length) {
      analysis.missingInformation.push("Documentos oficiais localizados, mas não processados: " + documentsNotProcessed.join("; "));
    }
    await logAnalysisAudit(userId, opportunityId, "orbe_ai.edital_analysis.completed", {
      provider: "google_gemini",
      model,
      documentAnalyzed: analysis.documentAnalyzed,
      documentName: analysis.documentName,
      documentsAnalyzed,
      documentsNotProcessed,
      documentSizeBytes,
      promptTokenCount: tokenUsage.promptTokenCount ?? null,
      candidatesTokenCount: tokenUsage.candidatesTokenCount ?? null,
      totalTokenCount: tokenUsage.totalTokenCount ?? null,
      elapsedMs: Date.now() - startedAt,
      sourceCode: opportunity.sourceCode,
    });
    return {
      opportunityId,
      generatedAt: new Date().toISOString(),
      source: opportunity.sourceName,
      sourceUrl: opportunity.noticeUrl ?? opportunity.sourceUrl,
      analysis,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    await logAnalysisAudit(userId, opportunityId, "orbe_ai.edital_analysis.failed", {
      provider: "google_gemini",
      model,
      documentAnalyzed: false,
      documentSizeBytes,
      elapsedMs: Date.now() - startedAt,
      error: message.slice(0, 300),
    });
    if (error instanceof TRPCError) throw error;
    console.error("[edital-analysis] failed", message);
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível concluir a análise. O serviço de IA ou o processamento dos documentos apresentou uma falha. Tente novamente." });
  }
}
