import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mailMocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
  close: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mailMocks.createTransport },
}));

import { EmailDeliveryError, sendPasswordResetEmail, sendVerificationEmail } from "./email";

const input = {
  to: "destino@example.com",
  name: "<Pessoa> & teste",
  token: "a".repeat(43),
  tokenHash: "b".repeat(64),
};

function configureSmtp() {
  vi.stubEnv("LICITAHUB_EMAIL_PROVIDER", "smtp");
  vi.stubEnv("LICITAHUB_SMTP_USER", "remetente@gmail.com");
  vi.stubEnv("LICITAHUB_SMTP_APP_PASSWORD", "abcd efgh ijkl mnop");
  vi.stubEnv("LICITAHUB_PUBLIC_BASE_URL", "https://licitahub.example");
  vi.stubEnv("LICITAHUB_EMAIL_FROM", "");
}

describe("transactional email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureSmtp();
    mailMocks.sendMail.mockResolvedValue({ accepted: [input.to], rejected: [] });
    mailMocks.createTransport.mockReturnValue({
      sendMail: mailMocks.sendMail,
      close: mailMocks.close,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends verification through Gmail STARTTLS with the app-password whitespace normalized", async () => {
    await sendVerificationEmail(input);

    expect(mailMocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: "remetente@gmail.com", pass: "abcdefghijklmnop" },
    }));
    expect(mailMocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: "LicitaHub <remetente@gmail.com>",
      to: input.to,
      subject: "Confirme seu e-mail do LicitaHub",
      html: expect.stringContaining("https://licitahub.example/verify-email?token="),
      text: expect.stringContaining("24 horas"),
    }));
    expect(mailMocks.sendMail.mock.calls[0][0].html).toContain("&lt;Pessoa&gt; &amp; teste");
    expect(mailMocks.close).toHaveBeenCalledOnce();
  });

  it("sends password recovery through the same transport and uses the 30-minute token URL", async () => {
    await sendPasswordResetEmail(input);

    expect(mailMocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      subject: "Redefina sua senha do LicitaHub",
      html: expect.stringContaining("https://licitahub.example/reset-password?token="),
      text: expect.stringContaining("30 minutos"),
    }));
  });

  it("sanitizes SMTP authentication failures and does not expose raw provider text", async () => {
    mailMocks.sendMail.mockRejectedValueOnce(Object.assign(new Error("private SMTP response"), { code: "EAUTH" }));

    await expect(sendVerificationEmail(input)).rejects.toMatchObject({
      name: "EmailDeliveryError",
      code: "smtp_auth_failed",
      message: "Email delivery is unavailable.",
    });
  });

  it("rejects a message not accepted by Gmail instead of reporting a false success", async () => {
    mailMocks.sendMail.mockResolvedValueOnce({ accepted: [], rejected: [input.to] });

    await expect(sendVerificationEmail(input)).rejects.toMatchObject({
      code: "provider_rejected",
    });
  });

  it("retains the future Resend transport without creating an SMTP connection", async () => {
    vi.stubEnv("LICITAHUB_EMAIL_PROVIDER", "resend");
    vi.stubEnv("LICITAHUB_RESEND_API_KEY", "test-resend-key-not-a-real-secret");
    vi.stubEnv("LICITAHUB_EMAIL_FROM", "LicitaHub <noreply@example.com>");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendVerificationEmail(input);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.resend.com/emails");
    expect(mailMocks.createTransport).not.toHaveBeenCalled();
  });

  it("requires a public HTTPS origin and fails closed without opening a transport", async () => {
    vi.stubEnv("LICITAHUB_PUBLIC_BASE_URL", "http://localhost:3000");

    await expect(sendVerificationEmail(input)).rejects.toBeInstanceOf(EmailDeliveryError);
    expect(mailMocks.createTransport).not.toHaveBeenCalled();
  });
});
