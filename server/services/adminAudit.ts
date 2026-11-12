import { auditLogs } from "../../drizzle/schema";
import { getDb } from "../db";

type AdminAuditInput = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  companyId?: string | null;
  details?: Record<string, unknown>;
};

/**
 * Registro único para operações administrativas. O payload deve conter apenas
 * metadados de rastreabilidade; nunca incluir senha, token, segredo ou conteúdo
 * integral de requisições externas.
 */
export async function recordAdminAudit(input: AdminAuditInput): Promise<void> {
  await getDb().insert(auditLogs).values({
    actorUserId: input.actorUserId,
    companyId: input.companyId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    details: input.details ?? {},
  });
}
