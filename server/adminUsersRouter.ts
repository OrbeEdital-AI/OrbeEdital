import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, authSessions, users, companies, companyMembers, subscriptions, plans } from "../drizzle/schema";
import { getDb } from "./db";
import { router, superadminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { cancelMercadoPagoSubscription } from "./services/mercadoPago";

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
          phone: users.phone,
          role: users.role,
          emailVerifiedAt: users.emailVerifiedAt,
          suspendedAt: users.suspendedAt,
          suspensionReason: users.suspensionReason,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
          companyName: sql<string | null>`(select c.legal_name from companies c inner join company_members cm on cm.company_id = c.id where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
          companyCnpj: sql<string | null>`(select c.cnpj from companies c inner join company_members cm on cm.company_id = c.id where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
          companyState: sql<string | null>`(select c.state from companies c inner join company_members cm on cm.company_id = c.id where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
          companyMunicipality: sql<string | null>`(select c.municipality from companies c inner join company_members cm on cm.company_id = c.id where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
          companySegment: sql<string | null>`(select c.primary_segment from companies c inner join company_members cm on cm.company_id = c.id where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
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


  updateCustomer: superadminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      name: z.string().trim().min(2).max(160),
      email: z.string().trim().email().max(320).transform(value => value.toLowerCase()),
      phone: z.string().trim().max(40).optional().or(z.literal("")),
      companyName: z.string().trim().min(2).max(240).optional(),
      cnpj: z.string().trim().max(18).optional().or(z.literal("")),
      state: z.string().trim().length(2).optional().or(z.literal("")),
      municipality: z.string().trim().max(160).optional().or(z.literal("")),
      primarySegment: z.string().trim().max(200).optional().or(z.literal("")),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async tx => {
        const [target] = await tx.select({
          id: users.id, role: users.role, name: users.name, email: users.email, phone: users.phone,
        }).from(users).where(eq(users.id, input.userId)).limit(1);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
        if (target.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "Somente contas de clientes podem ser editadas por esta função." });

        const [duplicateEmail] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
        if (duplicateEmail && duplicateEmail.id !== target.id) {
          throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado em outra conta." });
        }

        const [membership] = await tx.select({ companyId: companyMembers.companyId })
          .from(companyMembers).where(eq(companyMembers.userId, target.id))
          .orderBy(companyMembers.createdAt).limit(1);
        if (input.cnpj && membership) {
          const [duplicateCnpj] = await tx.select({ id: companies.id }).from(companies)
            .where(eq(companies.cnpj, input.cnpj)).limit(1);
          if (duplicateCnpj && duplicateCnpj.id !== membership.companyId) {
            throw new TRPCError({ code: "CONFLICT", message: "Este CNPJ já está vinculado a outra empresa." });
          }
        }

        await tx.update(users).set({
          name: input.name,
          email: input.email,
          phone: input.phone || null,
          emailVerifiedAt: target.email.toLowerCase() === input.email ? undefined : null,
          updatedAt: new Date(),
        }).where(eq(users.id, target.id));

        if (membership) {
          await tx.update(companies).set({
            ...(input.companyName !== undefined ? { legalName: input.companyName } : {}),
            ...(input.cnpj !== undefined ? { cnpj: input.cnpj || null } : {}),
            ...(input.state !== undefined ? { state: input.state || null } : {}),
            ...(input.municipality !== undefined ? { municipality: input.municipality || null } : {}),
            ...(input.primarySegment !== undefined ? { primarySegment: input.primarySegment || null } : {}),
            updatedAt: new Date(),
          }).where(eq(companies.id, membership.companyId));
        }

        await tx.insert(auditLogs).values({
          actorUserId: ctx.user.id,
          companyId: membership?.companyId ?? null,
          action: "user.customer_data.admin_updated",
          entityType: "user",
          entityId: target.id,
          details: {
            targetEmailBefore: target.email,
            targetEmailAfter: input.email,
            changedFields: ["name", "email", "phone", "companyName", "cnpj", "state", "municipality", "primarySegment"],
            emailVerificationReset: target.email.toLowerCase() !== input.email,
          },
        });
        return { updated: true, email: input.email, emailVerificationReset: target.email.toLowerCase() !== input.email };
      });
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


  deleteAccount: superadminProcedure
    .input(z.object({ userId: z.string().uuid(), confirmationEmail: z.string().trim().email().max(320) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [target] = await db.select({ id: users.id, role: users.role, email: users.email, name: users.name })
        .from(users).where(eq(users.id, input.userId)).limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
      if (target.role !== "user") {
        throw new TRPCError({ code: "FORBIDDEN", message: "A exclusão pelo painel está disponível somente para contas de clientes." });
      }
      if (target.email.toLowerCase() !== input.confirmationEmail.toLowerCase()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "O e-mail de confirmação não corresponde à conta selecionada." });
      }

      const [membership] = await db.select({ companyId: companyMembers.companyId })
        .from(companyMembers).where(eq(companyMembers.userId, target.id))
        .orderBy(companyMembers.createdAt).limit(1);
      const companyId = membership?.companyId ?? null;

      if (companyId) {
        const companySubscriptions = await db.select({
          id: subscriptions.id,
          provider: subscriptions.provider,
          providerSubscriptionId: subscriptions.providerSubscriptionId,
          status: subscriptions.status,
        }).from(subscriptions).where(eq(subscriptions.companyId, companyId));

        // Cancel provider-side subscriptions before removing local records.
        for (const subscription of companySubscriptions) {
          if (subscription.provider === "mercadopago" && subscription.providerSubscriptionId && subscription.status !== "cancelled") {
            await cancelMercadoPagoSubscription(subscription.id).catch(error => {
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: "Não foi possível cancelar a assinatura vinculada ao Mercado Pago. A conta foi mantida. Regularize a assinatura no provedor e tente novamente.",
                cause: error,
              });
            });
          }
        }
      }

      await db.transaction(async tx => {
        const [lockedTarget] = await tx.select({ id: users.id, role: users.role, email: users.email })
          .from(users).where(eq(users.id, input.userId)).limit(1);
        if (!lockedTarget || lockedTarget.role !== "user" || lockedTarget.email.toLowerCase() !== input.confirmationEmail.toLowerCase()) {
          throw new TRPCError({ code: "CONFLICT", message: "A conta mudou durante a operação. Atualize a lista e tente novamente." });
        }

        let removedCompany = false;
        if (companyId) {
          const members = await tx.select({ userId: companyMembers.userId }).from(companyMembers)
            .where(eq(companyMembers.companyId, companyId));
          removedCompany = members.every(member => member.userId === target.id);
        }

        // Write the audit record while the company FK still exists.
        // Deleting the company afterward applies ON DELETE SET NULL to audit_logs.company_id,
        // preserving the audit entry without retaining a dangling company reference.
        await tx.insert(auditLogs).values({
          actorUserId: ctx.user.id,
          companyId,
          action: "user.account.deleted",
          entityType: "user",
          entityId: target.id,
          details: {
            targetEmail: target.email,
            targetName: target.name,
            companyRemoved: removedCompany,
            deletedAt: new Date().toISOString(),
          },
        });

        if (companyId && removedCompany) {
          await tx.delete(companies).where(eq(companies.id, companyId));
        }
        await tx.delete(users).where(eq(users.id, target.id));
      });

      return { deleted: true, email: target.email };
    }),

  setSuspension: superadminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      suspended: z.boolean(),
      reason: z.string().trim().max(500).optional(),
    }).superRefine((value, ctx) => {
      if (value.suspended && !value.reason) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "Informe o motivo da suspensão." });
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async tx => {
        const [target] = await tx.select({
          id: users.id, role: users.role, email: users.email,
          suspendedAt: users.suspendedAt, suspensionReason: users.suspensionReason,
        }).from(users).where(eq(users.id, input.userId)).limit(1);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
        if (target.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "Somente contas de clientes podem ser suspensas por esta tela." });
        if (input.suspended && target.suspendedAt) return { updated: false, suspended: true, revokedCount: 0 };
        if (!input.suspended && !target.suspendedAt) return { updated: false, suspended: false, revokedCount: 0 };
        const now = new Date();
        await tx.update(users).set({
          suspendedAt: input.suspended ? now : null,
          suspensionReason: input.suspended ? input.reason!.trim() : null,
          updatedAt: now,
        }).where(eq(users.id, input.userId));
        const revoked = input.suspended
          ? await tx.delete(authSessions).where(eq(authSessions.userId, input.userId)).returning({ tokenHash: authSessions.tokenHash })
          : [];
        await tx.insert(auditLogs).values({
          actorUserId: ctx.user.id,
          action: input.suspended ? "user.account.suspended" : "user.account.reactivated",
          entityType: "user",
          entityId: input.userId,
          details: { targetEmail: target.email, reason: input.suspended ? input.reason!.trim() : target.suspensionReason, revokedSessionCount: revoked.length },
        });
        return { updated: true, suspended: input.suspended, revokedCount: revoked.length };
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
