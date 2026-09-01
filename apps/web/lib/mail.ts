/**
 * Lightweight outbound email helper.
 * Uses admin Email integration when enabled; falls back to SMTP_* env vars.
 * Skips sending when the email integration is disabled.
 */
import nodemailer from "nodemailer";
import { getIntegration, type EmailConfig } from "./integrations";

type MailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail(input: MailInput): Promise<{ sent: boolean; skipped?: string }> {
  const to = Array.isArray(input.to) ? input.to.filter(Boolean) : [input.to].filter(Boolean);
  if (!to.length) return { sent: false, skipped: "No recipients" };

  let integration: Awaited<ReturnType<typeof getIntegration<EmailConfig>>> = null;
  try {
    integration = await getIntegration<EmailConfig>("email");
  } catch (error) {
    console.warn("[mail:integration-unavailable]", error);
  }
  if (integration && !integration.is_enabled) {
    console.info("[mail:skipped]", {
      to,
      subject: input.subject,
      reason: "Email integration disabled"
    });
    return { sent: false, skipped: "Email integration disabled" };
  }

  const cfg = integration?.config || {};
  const host = String(cfg.host || process.env.SMTP_HOST || "");
  const user = String(cfg.user || process.env.SMTP_USER || "");
  const pass = String(cfg.pass || process.env.SMTP_PASS || "");
  const from =
    String(cfg.from || process.env.SMTP_FROM || process.env.SMTP_USER || "") ||
    "noreply@vasritha.local";
  const port = Number(cfg.port || process.env.SMTP_PORT || 587);

  if (!host || !user || !pass) {
    console.info("[mail:skipped]", {
      to,
      subject: input.subject,
      text: input.text,
      reason: "SMTP not configured (enable Email integration or set SMTP_HOST, SMTP_USER, SMTP_PASS)"
    });
    return { sent: false, skipped: "SMTP not configured" };
  }

  // If no integration row yet, allow env-based send (backward compatible).
  // If row exists and is enabled, proceed with merged config above.

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    await transporter.sendMail({
      from,
      to: to.join(", "),
      subject: input.subject,
      text: input.text,
      html: input.html || `<pre style="font-family:sans-serif">${input.text}</pre>`
    });
    return { sent: true };
  } catch (error) {
    console.error("[mail:error]", error);
    return { sent: false, skipped: error instanceof Error ? error.message : "send failed" };
  }
}
