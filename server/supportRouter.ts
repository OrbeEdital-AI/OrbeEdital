import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { auditLogs, companyMembers, plans, subscriptions, supportMessages, supportTickets, users } from "../drizzle/schema";
import { getDb } from "./db";
import { authenticatedProcedure, router, superadminProcedure } from "./_core/trpc";

const ticketStatus = z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]);
const ticketPriority = z.enum(["normal", "high"]);
const messageBody = z.string().trim().min(1).max(8000);

async function getOwnedTicket(ticketId: string, userId: string) {
  const [ticket] = await getDb().select().from(supportTickets)
    .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId))).limit(1);
  if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Atendimento não encontrado." });
  return ticket;
}

export const supportRouter = router({
  myTickets: authenticatedProcedure.query(async ({ ctx }) => {
    return getDb().select().from(supportTickets)
      .where(eq(supportTickets.userId, ctx.user.id))
      .orderBy(desc(supportTickets.lastMessageAt)).limit(100);
  }),

  create: authenticatedProcedure.input(z.object({
    subject: z.string().trim().min(4).max(160),
    category: z.enum(["general", "billing", "technical", "opportunity", "account"]).default("general"),
    message: messageBody,
  })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    return db.transaction(async tx => {
      const [membership] = await tx.select({ companyId: companyMembers.companyId })
        .from(companyMembers).where(eq(companyMembers.userId, ctx.user.id))
        .orderBy(companyMembers.createdAt).limit(1);
      const [plan] = membership ? await tx.select({ code: plans.code })
        .from(subscriptions).innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(and(eq(subscriptions.companyId, membership.companyId), eq(subscriptions.status, "active")))
        .orderBy(desc(subscriptions.createdAt)).limit(1) : [];
      const priority = plan?.code === "profissional" ? "high" : "normal";
      const [ticket] = await tx.insert(supportTickets).values({
        userId: ctx.user.id, companyId: membership?.companyId ?? null,
        subject: input.subject, category: input.category, priority,
        status: "open", lastMessageAt: new Date(),
      }).returning();
      await tx.insert(supportMessages).values({ ticketId: ticket.id, senderUserId: ctx.user.id, body: input.message });
      await tx.insert(auditLogs).values({
        actorUserId: ctx.user.id, companyId: membership?.companyId ?? null,
        action: "support.ticket.created", entityType: "support_ticket", entityId: ticket.id,
        details: { category: input.category, priority },
      });
      return ticket;
    });
  }),

  messages: authenticatedProcedure.input(z.object({ ticketId: z.string().uuid() })).query(async ({ input, ctx }) => {
    const ticket = await getOwnedTicket(input.ticketId, ctx.user.id);
    return getDb().select().from(supportMessages)
      .where(and(eq(supportMessages.ticketId, ticket.id), eq(supportMessages.isInternal, false)))
      .orderBy(supportMessages.createdAt);
  }),

  reply: authenticatedProcedure.input(z.object({ ticketId: z.string().uuid(), message: messageBody })).mutation(async ({ input, ctx }) => {
    const ticket = await getOwnedTicket(input.ticketId, ctx.user.id);
    if (["resolved", "closed"].includes(ticket.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Este atendimento foi encerrado. Reabra um novo chamado para continuar." });
    }
    const db = getDb();
    return db.transaction(async tx => {
      const [message] = await tx.insert(supportMessages).values({
        ticketId: ticket.id, senderUserId: ctx.user.id, body: input.message,
      }).returning();
      await tx.update(supportTickets).set({
        status: "open", lastMessageAt: new Date(), updatedAt: new Date(),
      }).where(eq(supportTickets.id, ticket.id));
      return message;
    });
  }),

  adminQueue: superadminProcedure.input(z.object({
    status: ticketStatus.optional(),
    priority: ticketPriority.optional(),
    query: z.string().trim().max(160).optional(),
  }).optional()).query(async ({ input }) => {
    const filters = [];
    if (input?.status) filters.push(eq(supportTickets.status, input.status));
    if (input?.priority) filters.push(eq(supportTickets.priority, input.priority));
    const rows = await getDb().select({
      ticket: supportTickets,
      customerName: users.name,
      customerEmail: users.email,
    }).from(supportTickets).innerJoin(users, eq(supportTickets.userId, users.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(supportTickets.lastMessageAt)).limit(200);
    const assignedIds = [...new Set(rows.map(row => row.ticket.assignedToUserId).filter((id): id is string => Boolean(id)))];
    const assignees = assignedIds.length
      ? await getDb().select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, assignedIds))
      : [];
    const names = new Map(assignees.map(item => [item.id, item.name]));
    const query = input?.query?.toLowerCase();
    return rows.filter(row => !query || row.customerName.toLowerCase().includes(query) || row.customerEmail.toLowerCase().includes(query) || row.ticket.subject.toLowerCase().includes(query))
      .map(row => ({ ...row.ticket, customerName: row.customerName, customerEmail: row.customerEmail, assignedName: row.ticket.assignedToUserId ? names.get(row.ticket.assignedToUserId) ?? null : null }))
      .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1));
  }),

  adminMessages: superadminProcedure.input(z.object({ ticketId: z.string().uuid() })).query(async ({ input }) => {
    return getDb().select({
      id: supportMessages.id, ticketId: supportMessages.ticketId, senderUserId: supportMessages.senderUserId,
      body: supportMessages.body, isInternal: supportMessages.isInternal, createdAt: supportMessages.createdAt,
      senderName: users.name, senderEmail: users.email,
    }).from(supportMessages).leftJoin(users, eq(supportMessages.senderUserId, users.id))
      .where(eq(supportMessages.ticketId, input.ticketId)).orderBy(supportMessages.createdAt);
  }),

  adminReply: superadminProcedure.input(z.object({
    ticketId: z.string().uuid(), message: messageBody, internal: z.boolean().default(false),
  })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, input.ticketId)).limit(1);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Atendimento não encontrado." });
    return db.transaction(async tx => {
      const [message] = await tx.insert(supportMessages).values({
        ticketId: ticket.id, senderUserId: ctx.user.id, body: input.message, isInternal: input.internal,
      }).returning();
      if (!input.internal) await tx.update(supportTickets).set({
        status: "waiting_customer", lastMessageAt: new Date(), updatedAt: new Date(),
      }).where(eq(supportTickets.id, ticket.id));
      await tx.insert(auditLogs).values({
        actorUserId: ctx.user.id, companyId: ticket.companyId,
        action: input.internal ? "support.note.created" : "support.reply.sent",
        entityType: "support_ticket", entityId: ticket.id,
        details: { internal: input.internal },
      });
      return message;
    });
  }),

  adminUpdate: superadminProcedure.input(z.object({
    ticketId: z.string().uuid(),
    status: ticketStatus.optional(),
    priority: ticketPriority.optional(),
    assignedToUserId: z.string().uuid().nullable().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, input.ticketId)).limit(1);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Atendimento não encontrado." });
    if (input.assignedToUserId) {
      const [assignee] = await db.select({ id: users.id, role: users.role }).from(users)
        .where(eq(users.id, input.assignedToUserId)).limit(1);
      if (!assignee || !["superadmin", "admin", "support"].includes(assignee.role)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Responsável deve ser um usuário da equipe administrativa ou de suporte." });
      }
    }
    const patch: Partial<typeof supportTickets.$inferInsert> = { updatedAt: new Date() };
    if (input.status) {
      patch.status = input.status;
      patch.closedAt = ["resolved", "closed"].includes(input.status) ? new Date() : null;
    }
    if (input.priority) patch.priority = input.priority;
    if (input.assignedToUserId !== undefined) patch.assignedToUserId = input.assignedToUserId;
    const [updated] = await db.update(supportTickets).set(patch).where(eq(supportTickets.id, ticket.id)).returning();
    await db.insert(auditLogs).values({
      actorUserId: ctx.user.id, companyId: ticket.companyId,
      action: "support.ticket.updated", entityType: "support_ticket", entityId: ticket.id,
      details: { status: input.status ?? ticket.status, priority: input.priority ?? ticket.priority, assignedToUserId: input.assignedToUserId === undefined ? ticket.assignedToUserId : input.assignedToUserId },
    });
    return updated;
  }),
});
