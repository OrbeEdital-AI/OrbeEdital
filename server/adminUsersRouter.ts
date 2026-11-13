import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, authSessions, users, companies, companyMembers, subscriptions, plans } from "../drizzle/schema";
import { getDb } from "./db";
import { router, superadminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";

/**
 * Read-only customer directory for the global administrator.
 * Password hashes and session tokens are deliberately never selected.
 */
export const adminUsersRouter = router({
  list: superadminProcedure
    .input(z.object({
      query: z.string().trim().max(160).optional(),
      page: z.number().int().min(1).max(100_000).default(1),
      pageSize: z.number().int().min(1).max(50).default(25),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const search = input.query?.trim();
      const where = search
        ? or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))
        : undefined;

      const [rows, totalRows] = await Promise.all([
        db.select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          emailVerifiedAt: users.emailVerifiedAt,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
          companyName: sql<string | null>`(select c.legal_name from companies c inner join company_members cm on cm.company_id = c.id where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
          companyId: sql<string | null>`(select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
          planName: sql<string | null>`(select p.name from subscriptions s inner join plans p on p.id = s.plan_id where s.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) order by s.created_at desc limit 1)`,
          subscriptionStatus: sql<string | null>`(select s.status from subscriptions s where s.company_id = (select cm.company_id from company_members cm where cm.user_id = "users"."id" order by cm.created_at asc limit 1) order by s.created_at desc limit 1)`,
        })
          .from(users)
          .where(where)
          .orderBy(desc(users.createdAt), desc(users.id))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        db.select({ total: count() }).from(users).where(where),
      ]);

      return {
        items: rows,
        total: totalRows[0]?.total ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        pageCount: Math.ceil((totalRows[0]?.total ?? 0) / input.pageSize),
      };
    }),


  plans: superadminProcedure.query(async () => {
    return getDb().select({
      id: plans.id,
      code: plans.code,
      name: plans.name,
      monthlyPriceCents: plans.monthlyPriceCents,
    }).from(plans).where(and(eq(plans.active, true), inArray(plans.code, ["essencial", "profissional"])));
  }),

  updatePlan: superadminProcedure
    .input(z.object({ userId: z.string().uuid(), planId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async tx => {
        const [target] = await tx.select({ id: users.id, role: users.role, email: users.email })
          .from(users).where(eq(users.id, input.userId)).limit(1);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
        if (target.role === "superadmin") throw new TRPCError({ code: "FORBIDDEN", message: "Não é permitido alterar o plano de uma conta superadmin." });

        const [membership] = await tx.select({ companyId: companyMembers.companyId })
          .from(companyMembers).where(eq(companyMembers.userId, input.userId))
          .orderBy(companyMembers.createdAt).limit(1);
        if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "Este usuário não possui empresa vinculada." });

        const [plan] = await tx.select({ id: plans.id, code: plans.code, name: plans.name })
          .from(plans).where(and(eq(plans.id, input.planId), eq(plans.active, true), inArray(plans.code, ["essencial", "profissional"]))).limit(1);
        if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "Plano indisponível ou não reconhecido." });

        const [current] = await tx.select({
          id: subscriptions.id,
          planId: subscriptions.planId,
          providerSubscriptionId: subscriptions.providerSubscriptionId,
        }).from(subscriptions).where(eq(subscriptions.companyId, membership.companyId))
          .orderBy(desc(subscriptions.createdAt)).limit(1);

        if (current?.providerSubscriptionId) {
          throw new TRPCError({ code: "CONFLICT", message: "Esta assinatura está vinculada ao Mercado Pago. Altere o plano no provedor de cobrança antes de atualizar o cadastro, para evitar divergência de valores." });
        }

        if (current) {
          await tx.update(subscriptions).set({
            planId: plan.id,
            status: "active",
            billingInterval: "monthly",
            cancelledAt: null,
            updatedAt: new Date(),
          }).where(eq(subscriptions.id, current.id));
        } else {
          await tx.insert(subscriptions).values({
            companyId: membership.companyId,
            planId: plan.id,
            status: "active",
            billingInterval: "monthly",
          });
        }

        await tx.insert(auditLogs).values({
          actorUserId: ctx.user.id,
          companyId: membership.companyId,
          action: "subscription.plan.admin_updated",
          entityType: "subscription",
          entityId: current?.id ?? membership.companyId,
          details: {
            targetEmail: target.email,
            previousPlanId: current?.planId ?? null,
            newPlanId: plan.id,
            newPlanCode: plan.code,
            newPlanName: plan.name,
            manuallyAssigned: true,
          },
        });
        return { updated: true, planName: plan.name };
      });
    }),

  updateRole: superadminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      role: z.enum(["user", "admin", "source_operator", "support", "finance"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async tx => {
        const [target] = await tx.select({ id: users.id, role: users.role, email: users.email })
          .from(users).where(eq(users.id, input.userId)).limit(1);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
        if (target.role === "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "A alteração de superadministradores exige procedimento de segurança separado." });
        }
        if (target.role === input.role) return { updated: false, role: target.role };
        await tx.update(users).set({ role: input.role, updatedAt: new Date() }).where(eq(users.id, input.userId));
        await tx.insert(auditLogs).values({
          actorUserId: ctx.user.id,
          action: "user.role.updated",
          entityType: "user",
          entityId: input.userId,
          details: { previousRole: target.role, newRole: input.role, targetEmail: target.email },
        });
        return { updated: true, role: input.role };
      });
    }),

  revokeSessions: superadminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async tx => {
        const [target] = await tx.select({ id: users.id, role: users.role, email: users.email })
          .from(users).where(eq(users.id, input.userId)).limit(1);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
        if (target.role === "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "O encerramento de sessões de superadministrador exige procedimento separado." });
        }
        const revoked = await tx.delete(authSessions).where(eq(authSessions.userId, input.userId)).returning({ tokenHash: authSessions.tokenHash });
        await tx.insert(auditLogs).values({
          actorUserId: ctx.user.id,
          action: "user.sessions.revoked",
          entityType: "user",
          entityId: input.userId,
          details: { targetEmail: target.email, revokedSessionCount: revoked.length },
        });
        return { revokedCount: revoked.length };
      });
    }),

  audit: superadminProcedure
    .input(z.object({
      query: z.string().trim().max(120).optional(),
      page: z.number().int().min(1).max(100_000).default(1),
      pageSize: z.number().int().min(1).max(50).default(25),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const search = input.query?.trim();
      const where = search
        ? or(
            ilike(auditLogs.action, `%${search}%`),
            ilike(auditLogs.entityType, `%${search}%`),
            ilike(auditLogs.entityId, `%${search}%`),
          )
        : undefined;
      const [items, totalRows] = await Promise.all([
        db.select({
          id: auditLogs.id,
          actorUserId: auditLogs.actorUserId,
          actorName: users.name,
          actorEmail: users.email,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          details: auditLogs.details,
          createdAt: auditLogs.createdAt,
        })
          .from(auditLogs)
          .leftJoin(users, sql`${users.id} = ${auditLogs.actorUserId}`)
          .where(where)
          .orderBy(desc(auditLogs.createdAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        db.select({ total: count() }).from(auditLogs).where(where),
      ]);
      return {
        items,
        total: totalRows[0]?.total ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        pageCount: Math.ceil((totalRows[0]?.total ?? 0) / input.pageSize),
      };
    }),
});
