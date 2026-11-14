import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { and, desc, eq, inArray } from "drizzle-orm";
import { companyMembers, payments, plans, subscriptions } from "../../drizzle/schema";
import { getDb } from "../db";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });
export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
const requireVerifiedEmail = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user?.emailVerifiedAt) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Confirme seu e-mail para acessar os recursos do OrbeEdital." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
export const authenticatedProcedure = t.procedure.use(requireUser);
const requireActiveSubscription = t.middleware(async ({ ctx, next }) => {
  if (["superadmin", "admin", "source_operator", "support", "finance"].includes(ctx.user.role)) {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }
  const [membership] = await getDb().select({ companyId: companyMembers.companyId })
    .from(companyMembers).where(eq(companyMembers.userId, ctx.user.id)).limit(1);
  const [active] = membership ? await getDb().select({ id: subscriptions.id }).from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .innerJoin(payments, eq(payments.subscriptionId, subscriptions.id))
    .where(and(eq(subscriptions.companyId, membership.companyId), eq(subscriptions.status, "active"), eq(payments.status, "approved"), eq(plans.active, true)))
    .orderBy(desc(subscriptions.createdAt)).limit(1) : [];
  if (!active) throw new TRPCError({ code: "FORBIDDEN", message: "Sua assinatura ainda não está ativa. Conclua o pagamento do plano para acessar o portal." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
export const protectedProcedure = t.procedure.use(requireUser).use(requireVerifiedEmail).use(requireActiveSubscription);

function requireRoles(roles: readonly string[]) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    if (!ctx.user.emailVerifiedAt) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Confirme seu e-mail para acessar os recursos do OrbeEdital." });
    }
    if (!roles.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export const adminProcedure = t.procedure.use(requireRoles(["superadmin", "admin", "source_operator", "support", "finance"]));
export const sourceOperatorProcedure = t.procedure.use(requireRoles(["superadmin", "admin", "source_operator"]));
export const financeProcedure = t.procedure.use(requireRoles(["superadmin", "admin", "finance"]));
export const superadminProcedure = t.procedure.use(requireRoles(["superadmin"]));
