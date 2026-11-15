import { and, asc, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  auditLogs, companyMembers, companyProfiles, companies, connectors,
  favorites, followedOpportunities, opportunityItems, opportunities, users,
} from "../drizzle/schema";
import { getDb } from "./db";
import { getPlanUsageSummary } from "./services/planLimits";
import { router, protectedProcedure, superadminProcedure } from "./_core/trpc";

const OPEN_STATUSES = ["published", "receiving_proposals", "open", "in_progress"];
const STOP_WORDS = new Set([
  "para", "com", "sem", "por", "uma", "uns", "umas", "dos", "das", "que", "de", "da", "do",
  "em", "no", "na", "nos", "nas", "ao", "aos", "e", "ou", "se", "ser", "ter", "mais", "menos",
  "sobre", "entre", "como", "pelo", "pela", "seu", "sua", "seus", "suas", "este", "esta",
  "item", "itens", "servico", "servicos", "material", "materiais", "aquisicao", "contratacao",
  "fornecimento", "empresa", "publica", "municipal", "estadual", "federal", "unidade",
  "pregao", "licitacao", "licitacoes", "edital", "editais", "processo", "registro", "preco",
  "precos", "compras", "orgao", "publico", "administrativo", "contrato", "contratos", "fornecedor",
]);

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}
function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}
function money(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function tokens(value: string) {
  return normalize(value).split(/[^a-z0-9]+/).filter(token => token.length >= 3);
}
function hasTerm(haystack: string, term: string) {
  const words = tokens(haystack);
  const needle = tokens(term);
  if (!needle.length) return false;
  return words.some((_, index) => needle.every((word, offset) => words[index + offset] === word));
}
function learnedInterestTerms(rows: Array<{ title: string; description: string | null }>) {
  const frequencies = new Map<string, number>();
  for (const row of rows) {
    const uniqueTokens = new Set(tokens([row.title, row.description ?? ""].join(" "))
      .filter(token => token.length >= 5 && !STOP_WORDS.has(token)));
    for (const token of uniqueTokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  return [...frequencies.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term]) => term);
}

export const orbeAiRouter = router({
  radar: protectedProcedure.mutation(async ({ ctx }) => {
    const planSummary = await getPlanUsageSummary(ctx.user.id);
    if (!planSummary.hasSubscription || planSummary.plan?.code !== "profissional") {
      throw new TRPCError({ code: "FORBIDDEN", message: "O Radar de Licitações do Orbe IA é exclusivo do plano Profissional." });
    }

    const db = getDb();
    const [membership] = await db.select({
      companyId: companyMembers.companyId,
      company: companies,
      profile: companyProfiles,
    }).from(companyMembers)
      .innerJoin(companies, eq(companyMembers.companyId, companies.id))
      .leftJoin(companyProfiles, eq(companyProfiles.companyId, companies.id))
      .where(eq(companyMembers.userId, ctx.user.id)).limit(1);

    if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "Não encontramos uma empresa vinculada à sua conta." });

    const profile = membership.profile;
    const profileTerms = [...new Set([
      membership.company.primarySegment ?? "",
      ...stringList(profile?.segments),
      ...stringList(profile?.products),
      ...stringList(profile?.services),
      ...stringList(profile?.keywords),
    ].map(normalize).filter(term => tokens(term).length > 0))].slice(0, 80);
    const catalogCodes = [...new Set([
      ...stringList(profile?.catmatCodes),
      ...stringList(profile?.catserCodes),
    ].map(code => code.replace(/\D/g, "")).filter(Boolean))].slice(0, 200);
    if (!profileTerms.length && !catalogCodes.length) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete o perfil da empresa com produtos, serviços, segmentos, palavras-chave ou códigos CATMAT/CATSER para ativar o Radar." });
    }

    // Preferências aprendidas somente a partir dos favoritos e oportunidades acompanhadas pelo próprio usuário.
    const [favoriteRows, followedRows] = await Promise.all([
      db.select({ id: opportunities.id, title: opportunities.title, description: opportunities.description })
        .from(favorites).innerJoin(opportunities, eq(favorites.opportunityId, opportunities.id))
        .where(eq(favorites.userId, ctx.user.id)).orderBy(desc(favorites.createdAt)).limit(50),
      db.select({ id: opportunities.id, title: opportunities.title, description: opportunities.description })
        .from(followedOpportunities).innerJoin(opportunities, eq(followedOpportunities.opportunityId, opportunities.id))
        .where(eq(followedOpportunities.userId, ctx.user.id)).orderBy(desc(followedOpportunities.updatedAt)).limit(50),
    ]);
    const uniqueInterestRows = [...new Map([...favoriteRows, ...followedRows].map(row => [row.id, row] as const)).values()];
    const interestTerms = learnedInterestTerms(uniqueInterestRows);

    const servedStates = stringList(profile?.servedStates).map(value => value.toUpperCase());
    const servedMunicipalities = stringList(profile?.servedMunicipalities).map(normalize);
    const minimumValue = money(profile?.minimumValue ?? null);
    const maximumValue = money(profile?.maximumValue ?? null);
    const now = new Date();

    // Oportunidades sem prazo também entram, mas ficam identificadas para conferência.
    // Status "unknown" foi removido para não tratar registros sem situação confirmada como abertos.
    const PAGE_SIZE = 250;
    let offset = 0;
    let candidateCount = 0;
    let totalMatchedCount = 0;
    const matches: Array<{
      id: string; title: string; description: string | null; agencyName: string | null;
      municipality: string | null; state: string | null; estimatedValue: string | null;
      proposalDeadline: Date | null; sourceName: string; sourceCode: string;
      score: number; reasons: string[]; needsDeadlineCheck: boolean;
    }> = [];

    // Percorre todos os registros em lotes estáveis, sem truncar a cobertura total.
    while (true) {
      const candidateRows = await db.select({
        opportunity: opportunities,
        sourceName: connectors.name,
        sourceCode: connectors.code,
      }).from(opportunities)
        .innerJoin(connectors, eq(opportunities.connectorId, connectors.id))
        .where(and(
          inArray(opportunities.status, OPEN_STATUSES),
          or(gte(opportunities.proposalDeadline, now), isNull(opportunities.proposalDeadline)),
        ))
        .orderBy(desc(opportunities.lastSyncedAt), desc(opportunities.publicationDate), asc(opportunities.id))
        .limit(PAGE_SIZE)
        .offset(offset);

      if (!candidateRows.length) break;
      offset += candidateRows.length;
      candidateCount += candidateRows.length;

      const candidateIds = candidateRows.map(row => row.opportunity.id);
      const itemRows = candidateIds.length
        ? await db.select({
            opportunityId: opportunityItems.opportunityId,
            catalogCode: opportunityItems.catalogCode,
            catalogSystem: opportunityItems.catalogSystem,
            description: opportunityItems.description,
          }).from(opportunityItems)
          .where(inArray(opportunityItems.opportunityId, candidateIds))
        : [];
      const itemsByOpportunity = new Map<string, typeof itemRows>();
      for (const item of itemRows) {
        const list = itemsByOpportunity.get(item.opportunityId) ?? [];
        list.push(item);
        itemsByOpportunity.set(item.opportunityId, list);
      }

      const pageMatches = candidateRows.flatMap(({ opportunity, sourceName, sourceCode }) => {
        if (servedStates.length && (!opportunity.state || !servedStates.includes(opportunity.state.toUpperCase()))) return [];
        if (servedMunicipalities.length && (!opportunity.municipality ||
            !servedMunicipalities.some(city => normalize(opportunity.municipality ?? "").includes(city)))) return [];
        const value = money(opportunity.estimatedValue);
        if (value !== null && minimumValue !== null && value < minimumValue) return [];
        if (value !== null && maximumValue !== null && value > maximumValue) return [];

        const searchable = [
          opportunity.title, opportunity.description ?? "", opportunity.agencyName ?? "",
          opportunity.procurementType ?? "", opportunity.modality ?? "",
        ].join(" ");
        const explicitTerms = [
          ...stringList(profile?.products).map(term => ({ term, weight: 35 })),
          ...stringList(profile?.services).map(term => ({ term, weight: 35 })),
          ...stringList(profile?.keywords).map(term => ({ term, weight: 20 })),
          ...stringList(profile?.segments).map(term => ({ term, weight: 12 })),
        ];
        const matchedExplicit = explicitTerms.filter(entry => hasTerm(searchable, entry.term));
        const matchedProfileTerms = matchedExplicit.map(entry => entry.term).slice(0, 5);
        const primarySegmentMatch = Boolean(membership.company.primarySegment && hasTerm(searchable, membership.company.primarySegment));
        const matchedInterestTerms = interestTerms.filter(term => hasTerm(searchable, term)).slice(0, 3);
        const opportunityItemsForMatch = itemsByOpportunity.get(opportunity.id) ?? [];
        const matchingItems = opportunityItemsForMatch.filter(item => {
          const itemText = [item.description, item.catalogCode ?? "", item.catalogSystem ?? ""].join(" ");
          const code = (item.catalogCode ?? "").replace(/\D/g, "");
          const codeMatch = code && catalogCodes.some(target => code === target);
          const termMatch = explicitTerms.some(entry => entry.weight >= 20 && hasTerm(itemText, entry.term));
          return Boolean(codeMatch || termMatch);
        });
        const matchedCatalogCodes = opportunityItemsForMatch
          .filter(item => catalogCodes.includes((item.catalogCode ?? "").replace(/\D/g, "")))
          .map(item => item.catalogCode)
          .filter((code): code is string => Boolean(code));
        const reasons: string[] = [];
        let score = Math.min(70, matchedExplicit.reduce((sum, entry) => sum + entry.weight, 0));
        if (matchedProfileTerms.length) reasons.push("Correspondência no perfil: " + matchedProfileTerms.join(", "));
        if (primarySegmentMatch && !matchedProfileTerms.length) {
          score += 8;
          reasons.push("Segmento geral da empresa relacionado — aderência fraca");
        }
        if (matchedInterestTerms.length) {
          score += Math.min(8, matchedInterestTerms.length * 3);
          reasons.push("Interesse complementar observado nos seus favoritos: " + matchedInterestTerms.join(", "));
        }
        if (matchingItems.length) {
          score += 25;
          reasons.push("Descrição de item compatível com produto/serviço cadastrado");
        }
        if (matchedCatalogCodes.length) {
          score += 40;
          reasons.push("Código CATMAT/CATSER correspondente: " + [...new Set(matchedCatalogCodes)].join(", "));
        }
        if (score < 25) return [];
        return [{
          id: opportunity.id,
          title: opportunity.title,
          description: opportunity.description,
          agencyName: opportunity.agencyName,
          municipality: opportunity.municipality,
          state: opportunity.state,
          estimatedValue: opportunity.estimatedValue,
          proposalDeadline: opportunity.proposalDeadline,
          sourceName,
          sourceCode,
          score: Math.min(100, score),
          reasons,
          needsDeadlineCheck: !opportunity.proposalDeadline,
        }];
      });

      totalMatchedCount += pageMatches.length;
      matches.push(...pageMatches);
      matches.sort((a, b) => b.score - a.score);
      if (matches.length > 40) matches.length = 40;
      if (candidateRows.length < PAGE_SIZE) break;
    }

    await db.insert(auditLogs).values({
      actorUserId: ctx.user.id,
      companyId: membership.companyId,
      action: "orbe_ai.radar.executed",
      entityType: "orbe_ai",
      entityId: membership.companyId,
      details: {
        matchedCount: totalMatchedCount,
        displayedCount: matches.length,
        candidateCount,
        coverageLimited: false,
        itemRowsLimited: false,
        learnedInterestTerms: interestTerms.length,
        matchingMode: "weighted_relevance_threshold_v3",
        provider: "internal",
        planCode: planSummary.plan?.code ?? null,
      },
    });

    return {
      generatedAt: new Date().toISOString(),
      candidateCount,
      matchedCount: totalMatchedCount,
      displayedCount: matches.length,
      coverageLimited: false,
      itemRowsLimited: false,
      learnedInterestCount: interestTerms.length,
      profileReady: true,
      items: matches,
    };
  }),

  adminUsage: superadminProcedure.query(async () => {
    return getDb().select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      details: auditLogs.details,
      userName: users.name,
      userEmail: users.email,
      companyName: companies.legalName,
    }).from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .leftJoin(companies, eq(auditLogs.companyId, companies.id))
      .where(inArray(auditLogs.action, ["orbe_ai.radar.executed", "orbe_ai.edital_analysis.completed", "orbe_ai.edital_analysis.failed"]))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
  }),
});
