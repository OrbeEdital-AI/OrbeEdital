import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

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
export const protectedProcedure = t.procedure.use(requireUser).use(requireVerifiedEmail);

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
export const userAdminProcedure = t.procedure.use(requireRoles(["superadmin", "admin"]));
export const financeProcedure = t.procedure.use(requireRoles(["superadmin", "admin", "finance"]));
export const superadminProcedure = t.procedure.use(requireRoles(["superadmin"]));
