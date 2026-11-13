import { count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, authSessions, users } from "../drizzle/schema";
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
          phone: users.phone,
          role: users.role,
          emailVerifiedAt: users.emailVerifiedAt,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
          companyName: sql<string | null>`(select c.legal_name from companies c inner join company_members cm on cm.company_id = c.id where cm.user_id = "users"."id" order by cm.created_at asc limit 1)`,
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

  updateProfile: superadminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      name: z.string().trim().min(1).max(160),
      phone: z.string().trim().max(40).nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      return db.transaction(async tx => {
        const [target] = await tx.select({
          id: users.id, name: users.name, phone: users.phone,
          email: users.email, role: users.role,
        }).from(users).where(eq(users.id, input.userId)).limit(1);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
        if (target.role === "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "A edição de superadministradores exige procedimento de segurança separado." });
        }
        const phone = input.phone?.trim() || null;
        if (target.name === input.name && target.phone === phone) return { updated: false };
        await tx.update(users).set({
          name: input.name,
          phone,
          updatedAt: new Date(),
        }).where(eq(users.id, input.userId));
        await tx.insert(auditLogs).values({
          actorUserId: ctx.user.id,
          action: "user.profile.updated",
          entityType: "user",
          entityId: input.userId,
          details: {
            targetEmail: target.email,
            changes: {
              name: { from: target.name, to: input.name },
              phone: { from: target.phone, to: phone },
            },
          },
        });
        return { updated: true };
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
