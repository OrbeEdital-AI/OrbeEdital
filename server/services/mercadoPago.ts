import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
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
    const apiError = body && typeof body === "object" ? body as {
      message?: unknown;
      error?: unknown;
      cause?: Array<{ code?: unknown; description?: unknown }>;
    } : {};
    const causes = Array.isArray(apiError.cause)
      ? apiError.cause.map(item => ({
          code: typeof item?.code === "string" || typeof item?.code === "number" ? item.code : undefined,
          description: typeof item?.description === "string" ? item.description.slice(0, 300) : undefined,
        }))
      : [];
    console.error("[mercadopago] API request rejected", {
      status: response.status,
      error: typeof apiError.error === "string" ? apiError.error : undefined,
      message: typeof apiError.message === "string" ? apiError.message.slice(0, 300) : undefined,
      causes,
    });
    const detail = causes.map(item => item.description || item.code).filter(Boolean).join("; ")
      || (typeof apiError.message === "string" ? apiError.message : "");
    throw new Error(detail
      ? `O Mercado Pago recusou a solicitação: ${detail}`
      : "O Mercado Pago recusou a solicitação. Verifique as configurações e tente novamente.");
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
  if (!Number.isInteger(amountCents) || amountCents < 0) throw new Error("Preço do plano inválido.");

  if (amountCents === 0) {
    if (plan.code !== "teste-gratis") throw new Error("Este plano gratuito não está disponível para ativação automática.");
    const [existing] = await db.select({ id: subscriptions.id }).from(subscriptions)
      .where(and(
        eq(subscriptions.companyId, membership.company.id),
        inArray(subscriptions.status, ["active", "trialing"]),
      )).orderBy(desc(subscriptions.createdAt)).limit(1);
    if (existing) throw new Error("Sua empresa já possui uma assinatura ativa. Cancele ou altere o plano atual antes de ativar o plano de teste.");

    const [freeSubscription] = await db.insert(subscriptions).values({
      companyId: membership.company.id,
      planId: plan.id,
      status: "active",
      billingInterval: "monthly",
      provider: "orbeedital",
      currentPeriodStart: new Date(),
    }).returning({ id: subscriptions.id });

    await db.insert(auditLogs).values({
      actorUserId: userId,
      companyId: membership.company.id,
      action: "subscription.free_test.activated",
      entityType: "subscription",
      entityId: freeSubscription.id,
      details: { planCode: plan.code, amountCents: 0 },
    });
    return { checkoutUrl: `${SITE_URL}/app?plan=teste-gratis-ativado` };
  }

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



function validCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    if (/^(\d)\\1+$/.test(digits)) return false;
    const calc = (base: string, factor: number) => {
      let total = 0;
      for (const digit of base) total += Number(digit) * factor--;
      const rest = (total * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    return calc(digits.slice(0, 9), 10) === Number(digits[9]) &&
      calc(digits.slice(0, 10), 11) === Number(digits[10]);
  }
  if (digits.length === 14) {
    if (/^(\d)\\1+$/.test(digits)) return false;
    const digit = (base: string, weights: number[]) => {
      const total = base.split("").reduce((sum, n, i) => sum + Number(n) * weights[i], 0);
      const rest = total % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    const first = digit(digits.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
    const second = digit(digits.slice(0, 12) + first, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
    return first === Number(digits[12]) && second === Number(digits[13]);
  }
  return false;
}

export async function createMercadoPagoPix(userId: string, planId: string, interval: "monthly" | "annual", payerDocument?: string) {
  const db = getDb();
  const [membership] = await db.select({ company: companies, email: users.email })
    .from(companyMembers).innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .innerJoin(users, eq(companyMembers.userId, users.id))
    .where(eq(companyMembers.userId, userId)).limit(1);
  if (!membership) throw new Error("Sua conta não possui uma empresa vinculada.");
  const [plan] = await db.select().from(plans)
    .where(and(eq(plans.id, planId), eq(plans.active, true))).limit(1);
  if (!plan) throw new Error("Plano indisponível.");
  const amountCents = interval === "annual" ? plan.annualPriceCents : plan.monthlyPriceCents;
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Este plano não possui cobrança Pix disponível.");
  const companyCnpj = String(membership.company.cnpj || "").replace(/\D/g, "");
  const document = companyCnpj || String(payerDocument || "").replace(/\D/g, "");
  if (!document) throw new Error("Informe um CPF ou CNPJ para gerar o Pix.");
  if (!validCpfCnpj(document)) throw new Error(companyCnpj ? "O CNPJ cadastrado da empresa é inválido. Atualize o cadastro antes de pagar." : "O CPF ou CNPJ informado é inválido.");
  const documentType = document.length === 14 ? "CNPJ" : "CPF";

  const [localSubscription] = await db.insert(subscriptions).values({
    companyId: membership.company.id, planId: plan.id, status: "pending",
    billingInterval: interval, provider: "mercadopago",
  }).returning({ id: subscriptions.id });

  try {
    const expiration = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const created = await mpRequest<any>("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": randomUUID() },
      body: JSON.stringify({
        transaction_amount: amountCents / 100,
        description: `OrbeEdital - ${plan.name} (${interval === "annual" ? "anual" : "mensal"})`,
        payment_method_id: "pix",
        external_reference: localSubscription.id,
        notification_url: `${SITE_URL}/api/webhooks/mercadopago`,
        date_of_expiration: expiration.toISOString(),
        payer: { email: membership.email, identification: { type: documentType, number: document } },
      }),
    });
    const transaction = created.point_of_interaction?.transaction_data;
    if (!created.id || !transaction?.qr_code || !transaction?.qr_code_base64) {
      throw new Error("O Mercado Pago não retornou os dados do QR Code Pix.");
    }
    const pixData = {
      pixQrCode: String(transaction.qr_code),
      pixQrCodeBase64: String(transaction.qr_code_base64),
      pixTicketUrl: transaction.ticket_url ? String(transaction.ticket_url) : null,
      expiresAt: created.date_of_expiration || expiration.toISOString(),
    };
    await db.insert(payments).values({
      subscriptionId: localSubscription.id, companyId: membership.company.id,
      provider: "mercadopago", providerPaymentId: String(created.id),
      amountCents, currency: "BRL", status: String(created.status || "pending"),
      rawStatus: JSON.stringify(pixData),
    });
    return { paymentId: String(created.id), ...pixData, amountCents, planName: plan.name };
  } catch (error) {
    await db.update(subscriptions).set({ status: "failed", updatedAt: new Date() })
      .where(eq(subscriptions.id, localSubscription.id));
    throw error;
  }
}

export async function getMercadoPagoPixStatus(userId: string, paymentId: string) {
  const db = getDb();
  const [membership] = await db.select({ companyId: companyMembers.companyId }).from(companyMembers)
    .where(eq(companyMembers.userId, userId)).limit(1);
  if (!membership) throw new Error("Empresa não encontrada.");
  const [payment] = await db.select().from(payments).where(and(
    eq(payments.companyId, membership.companyId),
    eq(payments.provider, "mercadopago"),
    eq(payments.providerPaymentId, paymentId),
  )).limit(1);
  if (!payment) throw new Error("Cobrança Pix não encontrada.");
  let pix: Record<string, unknown> = {};
  try { pix = JSON.parse(payment.rawStatus || "{}"); } catch { /* older payment record */ }
  return { status: payment.status, paidAt: payment.paidAt, ...pix };
}
\nexport async function cancelMercadoPagoSubscription(subscriptionId: string) {
  const db = getDb();
  const [subscription] = await db.select().from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId)).limit(1);
  if (!subscription || subscription.provider !== "mercadopago" || !subscription.providerSubscriptionId) {
    throw new Error("Assinatura pendente não encontrada no Mercado Pago.");
  }
  if (subscription.status === "cancelled") return;
  try {
    await mpRequest<any>(`/preapproval/${encodeURIComponent(subscription.providerSubscriptionId)}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    });
  } catch (error) {
    // Mercado Pago rejects updates when the preapproval is already cancelled.
    // Treat this specific response as an idempotent success and reconcile local state.
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("you can not modify a cancelled preapproval")) {
      throw error;
    }
  }
  await db.update(subscriptions).set({
    status: "cancelled",
    cancelledAt: subscription.cancelledAt ?? new Date(),
    updatedAt: new Date(),
  }).where(eq(subscriptions.id, subscription.id));
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
  if (!current.provider && !current.providerSubscriptionId) {
    // Admin-assigned subscriptions have no recurring payment yet. Start checkout
    // for the new plan and keep the current access until Mercado Pago confirms it.
    return createMercadoPagoCheckout(userId, planId, "monthly");
  }
  if (current.provider !== "mercadopago" || !current.providerSubscriptionId) {
    throw new Error("Esta assinatura usa outro meio de cobrança. Entre em contato com o suporte para alterar o plano.");
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

  if (type === "payment") {
    const remote = await mpRequest<any>(`/v1/payments/${encodeURIComponent(dataId)}`);
    if (String(remote.payment_method_id || "") !== "pix") return;
    const localId = String(remote.external_reference || "");
    if (!localId) return;
    const [local] = await getDb().select().from(subscriptions)
      .where(eq(subscriptions.id, localId)).limit(1);
    if (!local || local.provider !== "mercadopago") return;
    const [localPayment] = await getDb().select().from(payments).where(and(
      eq(payments.provider, "mercadopago"),
      eq(payments.providerPaymentId, String(remote.id)),
      eq(payments.subscriptionId, local.id),
      eq(payments.companyId, local.companyId),
    )).limit(1);
    if (!localPayment) return;
    const amountCents = Math.round(Number(remote.transaction_amount || 0) * 100);
    if (amountCents !== localPayment.amountCents || String(remote.currency_id || "BRL") !== "BRL") return;
    const paymentStatus = String(remote.status || "pending");
    let pixData: Record<string, unknown> = {};
    try { pixData = JSON.parse(localPayment.rawStatus || "{}"); } catch { /* ignore */ }
    await getDb().update(payments).set({
      status: paymentStatus,
      paidAt: paymentStatus === "approved" ? new Date(remote.date_approved || Date.now()) : null,
      rawStatus: JSON.stringify(pixData),
      updatedAt: new Date(),
    }).where(eq(payments.id, localPayment.id));
    if (paymentStatus === "approved" && local.status !== "cancelled" && local.status !== "failed") {
      const now = new Date();
      const periodEnd = new Date(now);
      if (local.billingInterval === "annual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);
      await getDb().update(subscriptions).set({
        status: "active", currentPeriodStart: now, currentPeriodEnd: periodEnd,
        gracePeriodEndsAt: null, updatedAt: now,
      }).where(eq(subscriptions.id, local.id));
      await getDb().update(subscriptions).set({
        status: "cancelled", cancelledAt: now, updatedAt: now,
      }).where(and(
        eq(subscriptions.companyId, local.companyId),
        inArray(subscriptions.status, ["active", "trialing"]),
        lt(subscriptions.createdAt, local.createdAt),
      ));
    }
    return;
  }

  if (type === "subscription_preapproval") {
    const remote = await mpRequest<any>(`/preapproval/${encodeURIComponent(dataId)}`);
    const localId = String(remote.external_reference || "");
    if (!localId) return;
    const statusMap: Record<string, string> = {
      authorized: "pending",
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
      status: status === "pending" && local.status === "active" ? "active" : status,
      cancelledAt: status === "cancelled" ? new Date() : null,
      currentPeriodStart: local.currentPeriodStart,
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
    if (paymentStatus === "approved" && local.status !== "cancelled") {
      await getDb().update(subscriptions).set({ status: "active", currentPeriodStart: local.currentPeriodStart || new Date(), updatedAt: new Date() })
        .where(eq(subscriptions.id, local.id));
      await getDb().update(subscriptions).set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      }).where(and(
        eq(subscriptions.companyId, local.companyId),
        inArray(subscriptions.status, ["active", "trialing"]),
        lt(subscriptions.createdAt, local.createdAt),
      ));
    }
  }
}
