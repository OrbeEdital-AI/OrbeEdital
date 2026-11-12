import { createHash } from "node:crypto";
import nodemailer from "nodemailer";

export type TransactionalEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type EmailProviderName = "gmail_smtp" | "resend" | "unknown";
type SelectedEmailProvider = Exclude<EmailProviderName, "unknown">;

export class EmailDeliveryError extends Error {
  constructor(readonly code: "configuration_missing" | "configuration_invalid" | "provider_rejected" | "smtp_auth_failed" | "transport_failed") {
    super("Email delivery is unavailable.");
    this.name = "EmailDeliveryError";
  }
}

function selectedEmailProvider(): SelectedEmailProvider {
  const configured = process.env.ORBEEDITAL_EMAIL_PROVIDER?.trim().toLowerCase() || "smtp";
  if (configured === "smtp") return "gmail_smtp";
  if (configured === "resend") return "resend";
  throw new EmailDeliveryError("configuration_invalid");
}

export function getEmailProviderForAudit(): EmailProviderName {
  try {
    return selectedEmailProvider();
  } catch {
    return "unknown";
  }
}

function getPublicOrigin(): string {
  const publicBaseUrl = process.env.ORBEEDITAL_PUBLIC_BASE_URL?.trim();
  if (!publicBaseUrl) throw new EmailDeliveryError("configuration_missing");

  let origin: URL;
  try {
    origin = new URL(publicBaseUrl);
  } catch {
    throw new EmailDeliveryError("configuration_invalid");
  }
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    (origin.pathname !== "/" && origin.pathname !== "")
  ) {
    throw new EmailDeliveryError("configuration_invalid");
  }
  return origin.origin;
}

function getGmailSmtpConfiguration() {
  const user = process.env.ORBEEDITAL_SMTP_USER?.trim();
  const rawAppPassword = process.env.ORBEEDITAL_SMTP_APP_PASSWORD?.trim();
  if (!user || !rawAppPassword) throw new EmailDeliveryError("configuration_missing");

  const appPassword = rawAppPassword.replace(/\s/g, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user) || !/^[A-Za-z0-9]{16}$/.test(appPassword)) {
    throw new EmailDeliveryError("configuration_invalid");
  }

  const from = process.env.ORBEEDITAL_EMAIL_FROM?.trim() || `OrbeEdital <${user}>`;
  if (/[\r\n]/.test(from)) throw new EmailDeliveryError("configuration_invalid");
  return { user, appPassword, from };
}

function getResendConfiguration() {
  const apiKey = process.env.ORBEEDITAL_RESEND_API_KEY?.trim();
  const from = process.env.ORBEEDITAL_EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new EmailDeliveryError("configuration_missing");
  if (/[\r\n]/.test(from)) throw new EmailDeliveryError("configuration_invalid");
  return { apiKey, from };
}

export function buildEmailActionUrl(path: "/verify-email" | "/reset-password", token: string): string {
  const url = new URL(path, getPublicOrigin());
  url.searchParams.set("token", token);
  return url.toString();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function template(title: string, name: string, link: string, actionLabel: string, expiry: string) {
  const safeName = escapeHtml(name || "");
  const safeLink = escapeHtml(link);
  return {
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f8fb;font-family:Arial,sans-serif;color:#1e293b"><main style="max-width:560px;margin:32px auto;padding:32px;background:#fff;border:1px solid #e2e8f0"><p style="font-size:13px;font-weight:bold;letter-spacing:.08em;color:#087eaa">ORBEEDITAL</p><h1 style="font-size:24px;color:#102b4e">${title}</h1><p>Olá${safeName ? `, ${safeName}` : ""}.</p><p>Para continuar, use o botão abaixo. Este link expira em ${expiry} e só pode ser usado uma vez.</p><p style="margin:28px 0"><a href="${safeLink}" style="display:inline-block;background:#087eaa;color:#fff;text-decoration:none;padding:12px 18px;font-weight:bold">${actionLabel}</a></p><p style="font-size:13px;color:#64748b">Se o botão não funcionar, copie este endereço para o navegador:<br><span>${safeLink}</span></p><p style="font-size:13px;color:#64748b">Se você não solicitou esta mensagem, ignore-a. Nunca compartilhe este link.</p></main></body></html>`,
    text: `${title}\n\nOlá${name ? `, ${name}` : ""}.\n\nAcesse este link para continuar: ${link}\n\nO link expira em ${expiry} e só pode ser usado uma vez. Se você não solicitou esta mensagem, ignore-a.`,
  };
}

async function sendGmailSmtpEmail(message: TransactionalEmail): Promise<void> {
  const { user, appPassword, from } = getGmailSmtpConfiguration();
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass: appPassword },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    tls: { minVersion: "TLSv1.2" },
  });

  try {
    const result = await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    const acceptedRecipients = result.accepted.map(recipient => recipient.toLowerCase());
    if (!acceptedRecipients.includes(message.to.toLowerCase())) {
      throw new EmailDeliveryError("provider_rejected");
    }
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    const smtpCode = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
    throw new EmailDeliveryError(smtpCode === "EAUTH" ? "smtp_auth_failed" : "transport_failed");
  } finally {
    transporter.close();
  }
}

async function sendResendEmail(message: TransactionalEmail): Promise<void> {
  const { apiKey, from } = getResendConfiguration();
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new EmailDeliveryError("transport_failed");
  }
  if (!response.ok) {
    // Provider response bodies may contain recipient/account data; never log them.
    console.error("[email] Resend rejected a transactional email", response.status);
    throw new EmailDeliveryError("provider_rejected");
  }
}

async function sendTransactionalEmail(message: TransactionalEmail): Promise<void> {
  const provider = selectedEmailProvider();
  getPublicOrigin();
  if (provider === "gmail_smtp") return sendGmailSmtpEmail(message);
  return sendResendEmail(message);
}

export async function sendVerificationEmail(input: {
  to: string;
  name: string;
  token: string;
  tokenHash: string;
}): Promise<void> {
  const link = buildEmailActionUrl("/verify-email", input.token);
  const content = template("Confirme seu e-mail", input.name, link, "Confirmar e-mail", "24 horas");
  await sendTransactionalEmail({
    to: input.to,
    subject: "Confirme seu e-mail do OrbeEdital",
    ...content,
    idempotencyKey: `email-verify-${createHash("sha256").update(input.tokenHash).digest("hex")}`,
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  token: string;
  tokenHash: string;
}): Promise<void> {
  const link = buildEmailActionUrl("/reset-password", input.token);
  const content = template("Redefina sua senha", input.name, link, "Criar nova senha", "30 minutos");
  await sendTransactionalEmail({
    to: input.to,
    subject: "Redefina sua senha do OrbeEdital",
    ...content,
    idempotencyKey: `password-reset-${createHash("sha256").update(input.tokenHash).digest("hex")}`,
  });
}
