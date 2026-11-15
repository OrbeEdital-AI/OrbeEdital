import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
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
const CANDIDATE_LIMIT = 1200;
const ITEM_LIMIT = 6000;
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
    const uniqueInterestRows = [...new Map([...favoriteRows, ...followedRows].map(row => [row.id, row])).values()];
    const interestTerms = learnedInterestTerms(uniqueInterestRows);

    const servedStates = stringList(profile?.servedStates).map(value => value.toUpperCase());
    const servedMunicipalities = stringList(profile?.servedMunicipalities).map(normalize);
    const minimumValue = money(profile?.minimumValue ?? null);
    const maximumValue = money(profile?.maximumValue ?? null);
    const now = new Date();

    // Oportunidades sem prazo também entram, mas ficam identificadas para conferência.
    // Status "unknown" foi removido para não tratar registros sem situação confirmada como abertos.
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
      .orderBy(desc(opportunities.lastSyncedAt), desc(opportunities.publicationDate))
      .limit(CANDIDATE_LIMIT + 1);

    const coverageLimited = candidateRows.length > CANDIDATE_LIMIT;
    const candidates = candidateRows.slice(0, CANDIDATE_LIMIT);
    const candidateIds = candidates.map(row => row.opportunity.id);
    const itemRows = candidateIds.length
      ? await db.select({
          opportunityId: opportunityItems.opportunityId,
          catalogCode: opportunityItems.catalogCode,
          catalogSystem: opportunityItems.catalogSystem,
          description: opportunityItems.description,
        }).from(opportunityItems)
        .where(inArray(opportunityItems.opportunityId, candidateIds))
        .limit(ITEM_LIMIT)
      : [];
    const itemRowsLimited = itemRows.length >= ITEM_LIMIT;
    const itemsByOpportunity = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      const list = itemsByOpportunity.get(item.opportunityId) ?? [];
      list.push(item);
      itemsByOpportunity.set(item.opportunityId, list);
    }

    const matches = candidates.flatMap(({ opportunity, sourceName, sourceCode }) => {
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
      const matchedProfileTerms = profileTerms.filter(term => hasTerm(searchable, term)).slice(0, 5);
      const matchedInterestTerms = interestTerms.filter(term => hasTerm(searchable, term)).slice(0, 5);
      const matchingItems = (itemsByOpportunity.get(opportunity.id) ?? []).filter(item => {
        const itemText = [item.description, item.catalogCode ?? "", item.catalogSystem ?? ""].join(" ");
        const code = (item.catalogCode ?? "").replace(/\D/g, "");
        const codeMatch = code && catalogCodes.some(target => code === target);
        const termMatch = profileTerms.some(term => hasTerm(itemText, term));
        return Boolean(codeMatch || termMatch);
      });
      const reasons: string[] = [];
      let score = Math.min(60, matchedProfileTerms.length * 15);
      if (matchedProfileTerms.length) reasons.push("Perfil empresarial: " + matchedProfileTerms.join(", "));
      if (matchedInterestTerms.length) {
        score += Math.min(15, matchedInterestTerms.length * 5);
        reasons.push("Interesses identificados nos seus favoritos e acompanhamentos: " + matchedInterestTerms.join(", "));
      }
      if (matchingItems.length) {
        score += 25;
        reasons.push("Item da oportunidade compatível com produtos/serviços ou código de catálogo");
      }
      const hasGeographicPreference = servedStates.length > 0 || servedMunicipalities.length > 0;
      const geographicMatch =
        (!servedStates.length || Boolean(opportunity.state && servedStates.includes(opportunity.state.toUpperCase()))) &&
        (!servedMunicipalities.length || Boolean(opportunity.municipality && servedMunicipalities.some(city => normalize(opportunity.municipality ?? "").includes(city))));
      if (hasGeographicPreference && geographicMatch) {
        score += 10;
        reasons.push("Localidade dentro da área de atendimento informada");
      }
      if (value !== null && (minimumValue !== null || maximumValue !== null)) {
        score += 5;
        reasons.push("Valor dentro da faixa definida no perfil");
      }
      if (score <= 0) return [];
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
    }).sort((a, b) => b.score - a.score).slice(0, 40);

    await db.insert(auditLogs).values({
      actorUserId: ctx.user.id,
      companyId: membership.companyId,
      action: "orbe_ai.radar.executed",
      entityType: "orbe_ai",
      entityId: membership.companyId,
      details: {
        matchedCount: matches.length,
        candidateCount: candidates.length,
        coverageLimited,
        itemRowsLimited,
        learnedInterestTerms: interestTerms.length,
        matchingMode: "profile_and_interest_rules_v2",
        provider: "internal",
        planCode: planSummary.plan?.code ?? null,
      },
    });

    return {
      generatedAt: new Date().toISOString(),
      candidateCount: candidates.length,
      matchedCount: matches.length,
      coverageLimited,
      itemRowsLimited,
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
