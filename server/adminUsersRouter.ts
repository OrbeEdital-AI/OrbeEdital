import { count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, users } from "../drizzle/schema";
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
          companyName: sql<string | null>`(select c.legal_name from companies c inner join company_members cm on cm.company_id = c.id where cm.user_id = ${users.id} order by cm.created_at asc limit 1)`,
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
