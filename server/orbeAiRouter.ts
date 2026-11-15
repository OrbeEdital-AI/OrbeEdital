import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  auditLogs, companyMembers, companyProfiles, companies, connectors,
  opportunityItems, opportunities, users,
} from "../drizzle/schema";
import { getDb } from "./db";
import { getPlanUsageSummary } from "./services/planLimits";
import { router, protectedProcedure, superadminProcedure } from "./_core/trpc";

const OPEN_STATUSES = ["unknown", "published", "receiving_proposals", "open", "in_progress"];

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
    const terms = [...new Set([
      membership.company.primarySegment ?? "",
      ...stringList(profile?.segments),
      ...stringList(profile?.products),
      ...stringList(profile?.services),
      ...stringList(profile?.keywords),
    ].map(normalize).filter(term => term.length >= 3))].slice(0, 80);
    const catalogCodes = [...new Set([
      ...stringList(profile?.catmatCodes),
      ...stringList(profile?.catserCodes),
    ].map(code => code.replace(/\\D/g, "")).filter(Boolean))].slice(0, 200);
    if (!terms.length && !catalogCodes.length) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complete o perfil da empresa com produtos, serviços, segmentos, palavras-chave ou códigos CATMAT/CATSER para ativar o Radar." });
    }

    const servedStates = stringList(profile?.servedStates).map(value => value.toUpperCase());
    const servedMunicipalities = stringList(profile?.servedMunicipalities).map(normalize);
    const minimumValue = money(profile?.minimumValue ?? null);
    const maximumValue = money(profile?.maximumValue ?? null);
    const now = new Date();

    const candidates = await db.select({
      opportunity: opportunities,
      sourceName: connectors.name,
      sourceCode: connectors.code,
    }).from(opportunities)
      .innerJoin(connectors, eq(opportunities.connectorId, connectors.id))
      .where(and(
        gte(opportunities.proposalDeadline, now),
        inArray(opportunities.status, OPEN_STATUSES),
      ))
      .orderBy(desc(opportunities.lastSyncedAt), desc(opportunities.publicationDate))
      .limit(1200);

    const candidateIds = candidates.map(row => row.opportunity.id);
    const itemRows = catalogCodes.length && candidateIds.length
      ? await db.select({
          opportunityId: opportunityItems.opportunityId,
          catalogCode: opportunityItems.catalogCode,
          catalogSystem: opportunityItems.catalogSystem,
          description: opportunityItems.description,
        }).from(opportunityItems)
        .where(inArray(opportunityItems.opportunityId, candidateIds))
        .limit(6000)
      : [];
    const itemsByOpportunity = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      const list = itemsByOpportunity.get(item.opportunityId) ?? [];
      list.push(item);
      itemsByOpportunity.set(item.opportunityId, list);
    }

    const matches = candidates.flatMap(({ opportunity, sourceName, sourceCode }) => {
      if (servedStates.length && opportunity.state && !servedStates.includes(opportunity.state.toUpperCase())) return [];
      if (servedMunicipalities.length && opportunity.municipality &&
          !servedMunicipalities.some(city => normalize(opportunity.municipality ?? "").includes(city))) return [];
      const value = money(opportunity.estimatedValue);
      if (value !== null && minimumValue !== null && value < minimumValue) return [];
      if (value !== null && maximumValue !== null && value > maximumValue) return [];

      const searchable = normalize([
        opportunity.title, opportunity.description ?? "", opportunity.agencyName ?? "",
        opportunity.procurementType ?? "", opportunity.modality ?? "",
      ].join(" "));
      const matchedTerms = terms.filter(term => searchable.includes(term)).slice(0, 5);
      const matchingCatalog = (itemsByOpportunity.get(opportunity.id) ?? []).filter(item => {
        const code = (item.catalogCode ?? "").replace(/\\D/g, "");
        return code && catalogCodes.some(target => code === target || code.startsWith(target) || target.startsWith(code));
      });
      const reasons: string[] = [];
      let score = Math.min(60, matchedTerms.length * 15);
      if (matchedTerms.length) reasons.push("Termos compatíveis: " + matchedTerms.join(", "));
      if (matchingCatalog.length) { score += 25; reasons.push("Código CATMAT/CATSER compatível"); }
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
        matchingMode: "profile_rules_v1",
        provider: "internal",
        planCode: planSummary.plan?.code ?? null,
      },
    });

    return {
      generatedAt: new Date().toISOString(),
      candidateCount: candidates.length,
      matchedCount: matches.length,
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
      .where(eq(auditLogs.action, "orbe_ai.radar.executed"))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
  }),
});
