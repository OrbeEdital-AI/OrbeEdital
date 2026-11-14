import { and, eq, gte, isNotNull, lt, or } from "drizzle-orm";
import { favorites, notifications, opportunities } from "../../drizzle/schema";
import { getDb } from "../db";

const TIME_ZONE = "America/Sao_Paulo";
const REMINDER_OFFSETS = new Set([7, 3, 1, 0]);

type AgendaEvent = {
  userId: string;
  opportunityId: string;
  title: string;
  kind: "deadline" | "opening" | "session";
  date: Date;
};

function dateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dayDifference(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

export async function dispatchDeadlineNotifications() {
  const db = getDb();
  const now = new Date();
  const today = dateKey(now);
  const startOfToday = new Date(`${today}T00:00:00-03:00`);
  const horizon = new Date(startOfToday.getTime() + 8 * 86_400_000);
  const rows = await db.select({
    userId: favorites.userId,
    opportunityId: opportunities.id,
    title: opportunities.title,
    proposalDeadline: opportunities.proposalDeadline,
    openingDate: opportunities.openingDate,
    sessionAt: opportunities.sessionAt,
  }).from(favorites)
    .innerJoin(opportunities, eq(favorites.opportunityId, opportunities.id))
    .where(or(
      and(isNotNull(opportunities.proposalDeadline), gte(opportunities.proposalDeadline, startOfToday), lt(opportunities.proposalDeadline, horizon)),
      and(isNotNull(opportunities.openingDate), gte(opportunities.openingDate, startOfToday), lt(opportunities.openingDate, horizon)),
      and(isNotNull(opportunities.sessionAt), gte(opportunities.sessionAt, startOfToday), lt(opportunities.sessionAt, horizon)),
    ));

  const events: AgendaEvent[] = [];
  for (const row of rows) {
    if (row.proposalDeadline) events.push({ userId: row.userId, opportunityId: row.opportunityId, title: row.title, kind: "deadline", date: row.proposalDeadline });
    if (row.openingDate) events.push({ userId: row.userId, opportunityId: row.opportunityId, title: row.title, kind: "opening", date: row.openingDate });
    if (row.sessionAt) events.push({ userId: row.userId, opportunityId: row.opportunityId, title: row.title, kind: "session", date: row.sessionAt });
  }

  let createdReminders = 0;
  let createdSummaries = 0;
  const upcomingByUser = new Map<string, AgendaEvent[]>();

  for (const event of events) {
    const days = dayDifference(today, dateKey(event.date));
    if (days < 0 || days > 7) continue;
    const list = upcomingByUser.get(event.userId) ?? [];
    list.push(event);
    upcomingByUser.set(event.userId, list);
    if (!REMINDER_OFFSETS.has(days)) continue;

    const eventDate = dateKey(event.date);
    const type = `agenda_${event.kind}_${eventDate}_${days}d`;
    const existing = await db.select({ id: notifications.id }).from(notifications)
      .where(and(
        eq(notifications.userId, event.userId),
        eq(notifications.opportunityId, event.opportunityId),
        eq(notifications.type, type),
      )).limit(1);
    if (existing.length) continue;

    const label = event.kind === "deadline" ? "Prazo para propostas" : event.kind === "opening" ? "Abertura da licitação" : "Sessão pública";
    const timing = days === 0 ? "é hoje" : days === 1 ? "é amanhã" : `em ${days} dias`;
    await db.insert(notifications).values({
      userId: event.userId,
      opportunityId: event.opportunityId,
      type,
      title: `${label} ${timing}`,
      message: `A oportunidade "${event.title}" tem ${label.toLocaleLowerCase("pt-BR")} em ${new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" }).format(event.date)}.`,
      href: `/app/opportunities/${event.opportunityId}`,
    });
    createdReminders += 1;
  }

  for (const [userId, userEvents] of upcomingByUser) {
    const type = `agenda_daily_summary_${today}`;
    const existing = await db.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.type, type))).limit(1);
    if (existing.length) continue;
    const uniqueOpportunities = new Set(userEvents.map(event => event.opportunityId)).size;
    await db.insert(notifications).values({
      userId,
      type,
      title: "Resumo diário da sua agenda",
      message: `Você tem ${userEvents.length} evento(s) nos próximos 7 dias, em ${uniqueOpportunities} oportunidade(s) acompanhada(s).`,
      href: "/app/agenda",
    });
    createdSummaries += 1;
  }

  return { scannedEvents: events.length, createdReminders, createdSummaries };
}
