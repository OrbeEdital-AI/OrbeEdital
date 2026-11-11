import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { SafeUser } from "../../drizzle/schema";
import { getUserFromRequest } from "../auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SafeUser | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  // No cookie means a public request. If a cookie is present but the database
  // cannot validate it, propagate the error; never downgrade to an anonymous
  // session to bypass authorization.
  const user = await getUserFromRequest(opts.req);
  return { req: opts.req, res: opts.res, user };
}
