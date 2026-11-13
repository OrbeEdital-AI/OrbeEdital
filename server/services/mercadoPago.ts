import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auditLogs, companyMembers, companies, payments, plans, subscriptions, users } from "../../drizzle/schema";
import { getDb } from "../db";

const MP_API = "https://api.mercadopago.com";
const SITE_URL = (process.env.APP_URL || "https://orbeedital.vercel.app").replace(/\/$/, "");

function accessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Mercado Pago não configurado.");
  return token;
}

async function mpRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[mercadopago] API request failed", response.status);
    throw new Error("Não foi possível comunicar com o Mercado Pago.");
  }
  return body as T;
}

export async function createMercadoPagoCheckout(userId: string, planId: string, interval: "monthly" | "annual") {
  const db = getDb();
  const [membership] = await db.select({
    company: companies,
    email: users.email,
  }).from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .innerJoin(users, eq(companyMembers.userId, users.id))
    .where(eq(companyMembers.userId, userId)).limit(1);
  if (!membership) throw new Error("Sua conta não possui uma empresa vinculada.");

  const [plan] = await db.select().from(plans)
    .where(and(eq(plans.id, planId), eq(plans.active, true))).limit(1);
  if (!plan) throw new Error("Plano indisponível.");
  const amountCents = interval === "annual" ? plan.annualPriceCents : plan.monthlyPriceCents;
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Este plano ainda não possui preço configurado para cobrança.");

  const [localSubscription] = await db.insert(subscriptions).values({
    companyId: membership.company.id,
    planId: plan.id,
    status: "pending",
    billingInterval: interval,
    provider: "mercadopago",
  }).returning({ id: subscriptions.id });

  try {
    const created = await mpRequest<{ id: string; init_point?: string; sandbox_init_point?: string }>("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: `OrbeEdital - ${plan.name}`,
        external_reference: localSubscription.id,
        payer_email: membership.email,
        auto_recurring: {
          frequency: interval === "annual" ? 12 : 1,
          frequency_type: "months",
          transaction_amount: amountCents / 100,
          currency_id: "BRL",
        },
        back_url: `${SITE_URL}/app/billing?checkout=return`,
        notification_url: `${SITE_URL}/api/webhooks/mercadopago`,
      }),
    });
    if (!created.id || !created.init_point) throw new Error("Mercado Pago não retornou o link de checkout.");
    await db.update(subscriptions).set({
      providerSubscriptionId: created.id,
      updatedAt: new Date(),
    }).where(eq(subscriptions.id, localSubscription.id));
    return { checkoutUrl: created.init_point };
  } catch (error) {
    await db.update(subscriptions).set({ status: "failed", updatedAt: new Date() })
      .where(eq(subscriptions.id, localSubscription.id));
    throw error;
  }
}


export async function changeMercadoPagoPlan(userId: string, planId: string) {
  const db = getDb();
  const [membership] = await db.select({ companyId: companyMembers.companyId })
    .from(companyMembers).where(eq(companyMembers.userId, userId)).limit(1);
  if (!membership) throw new Error("Sua conta não possui uma empresa vinculada.");

  const [targetPlan] = await db.select().from(plans)
    .where(and(eq(plans.id, planId), eq(plans.active, true))).limit(1);
  if (!targetPlan || !["essencial", "profissional"].includes(targetPlan.code)) {
    throw new Error("Plano indisponível.");
  }
  if (targetPlan.monthlyPriceCents <= 0) throw new Error("O plano selecionado não possui preço mensal configurado.");

  const [current] = await db.select().from(subscriptions)
    .where(and(
      eq(subscriptions.companyId, membership.companyId),
      inArray(subscriptions.status, ["active", "trialing"]),
    )).orderBy(desc(subscriptions.createdAt)).limit(1);
  if (!current) throw new Error("Não encontramos uma assinatura ativa para alterar.");
  if (current.planId === targetPlan.id) throw new Error("Este já é o plano atual.");
  if (current.provider !== "mercadopago" || !current.providerSubscriptionId) {
    throw new Error("Esta assinatura foi atribuída administrativamente e não possui cobrança recorrente vinculada ao Mercado Pago. Solicite a alteração ao suporte.");
  }

  await mpRequest<any>(`/preapproval/${encodeURIComponent(current.providerSubscriptionId)}`, {
    method: "PUT",
    body: JSON.stringify({
      reason: `OrbeEdital - ${targetPlan.name}`,
      auto_recurring: {
        transaction_amount: targetPlan.monthlyPriceCents / 100,
        currency_id: "BRL",
      },
    }),
  });

  await db.update(subscriptions).set({
    planId: targetPlan.id,
    billingInterval: "monthly",
    updatedAt: new Date(),
  }).where(eq(subscriptions.id, current.id));

  await db.insert(auditLogs).values({
    actorUserId: userId,
    companyId: membership.companyId,
    action: "subscription.plan.customer_changed",
    entityType: "subscription",
    entityId: current.id,
    details: {
      previousPlanId: current.planId,
      newPlanId: targetPlan.id,
      previousPlanCode: null,
      newPlanCode: targetPlan.code,
      provider: "mercadopago",
    },
  });

  return { success: true, planName: targetPlan.name };
}

function validWebhookSignature(signature: string, requestId: string, dataId: string, secret: string) {
  const parts = Object.fromEntries(signature.split(",").map(part => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
  const ts = parts.ts;
  const received = parts.v1;
  if (!ts || !received || !/^\d+$/.test(ts)) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function handleMercadoPagoWebhook(req: any) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) throw new Error("Webhook secret não configurado.");
  const signature = String(req.get("x-signature") || "");
  const requestId = String(req.get("x-request-id") || "");
  const dataId = String(req.query?.["data.id"] || req.query?.data?.id || req.query?.data_id || "");
  if (!signature || !requestId || !dataId || !validWebhookSignature(signature, requestId, dataId, secret)) {
    const error = new Error("Assinatura de webhook inválida.");
    (error as any).statusCode = 401;
    throw error;
  }

  const type = String(req.body?.type || req.query?.type || "");
  if (type === "subscription_preapproval") {
    const remote = await mpRequest<any>(`/preapproval/${encodeURIComponent(dataId)}`);
    const localId = String(remote.external_reference || "");
    if (!localId) return;
    const statusMap: Record<string, string> = {
      authorized: "active",
      pending: "pending",
      paused: "past_due",
      cancelled: "cancelled",
    };
    const status = statusMap[String(remote.status)] || "pending";
    const [local] = await getDb().select().from(subscriptions)
      .where(eq(subscriptions.id, localId)).limit(1);
    if (!local) return;
    await getDb().update(subscriptions).set({
      provider: "mercadopago",
      providerSubscriptionId: String(remote.id),
      status,
      cancelledAt: status === "cancelled" ? new Date() : null,
      currentPeriodStart: status === "active" ? (local.currentPeriodStart || new Date()) : local.currentPeriodStart,
      updatedAt: new Date(),
    }).where(eq(subscriptions.id, local.id));
    return;
  }

  if (type === "subscription_authorized_payment") {
    const invoice = await mpRequest<any>(`/authorized_payments/${encodeURIComponent(dataId)}`);
    const remoteSubscriptionId = String(invoice.preapproval_id || invoice.subscription_id || "");
    if (!remoteSubscriptionId) return;
    const [local] = await getDb().select().from(subscriptions)
      .where(eq(subscriptions.providerSubscriptionId, remoteSubscriptionId)).limit(1);
    if (!local) return;
    const amountCents = Math.round(Number(invoice.transaction_amount || 0) * 100);
    const rawStatus = String(invoice.payment?.status || invoice.summarized || invoice.status || "pending");
    const paymentStatus = rawStatus;
    await getDb().insert(payments).values({
      subscriptionId: local.id,
      companyId: local.companyId,
      provider: "mercadopago",
      providerPaymentId: String(invoice.payment?.id || invoice.id),
      amountCents,
      currency: String(invoice.currency_id || "BRL"),
      status: paymentStatus,
      paidAt: paymentStatus === "approved" ? new Date(invoice.date_created || Date.now()) : null,
      rawStatus,
    }).onConflictDoUpdate({
      target: [payments.provider, payments.providerPaymentId],
      set: { amountCents, status: paymentStatus, paidAt: paymentStatus === "approved" ? new Date(invoice.date_created || Date.now()) : null, rawStatus, updatedAt: new Date() },
    });
    if (paymentStatus === "approved") {
      await getDb().update(subscriptions).set({ status: "active", updatedAt: new Date() })
        .where(eq(subscriptions.id, local.id));
    }
  }
}
