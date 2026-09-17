import { NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { fail, ok, requirePermission } from "../../../../../lib/auth/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  host?: string;
  port?: number | string;
  user?: string;
  pass?: string;
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
};

/**
 * Straight SMTP test — pass mailer settings in the body (no Integrations UI required).
 *
 * POST /api/admin/integrations/test-email
 * Authorization: Bearer <admin token>
 *
 * {
 *   "host": "smtp.gmail.com",
 *   "port": 587,
 *   "user": "you@gmail.com",
 *   "pass": "xxxx xxxx xxxx xxxx",
 *   "from": "you@gmail.com",
 *   "to": "you@gmail.com",
 *   "subject": "SMTP test",
 *   "text": "Hello from Vasritha"
 * }
 */
export async function POST(request: NextRequest) {
  const { error } = await requirePermission(request, "settings:business");
  if (error) return error;

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return fail("JSON body required");

  const host = String(body.host || "").trim();
  const user = String(body.user || "").trim();
  const pass = String(body.pass || "").replace(/\s+/g, "");
  const to = String(body.to || "").trim().toLowerCase();
  const from = String(body.from || user).trim();
  const port = Number(body.port || 587);
  const subject = String(body.subject || `Vasritha SMTP test · ${new Date().toISOString()}`);
  const text = String(
    body.text ||
      `Straight SMTP test from Vasritha.\nSent at ${new Date().toISOString()}\nHost ${host}:${port}`
  );

  if (!host) return fail("host is required (e.g. smtp.gmail.com)");
  if (!user) return fail("user is required (your Gmail address)");
  if (!pass) return fail("pass is required (Gmail App Password, 16 characters)");
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return fail("to must be a valid email");
  }
  if (![25, 465, 587, 2525].includes(port)) {
    return fail("port must be 25, 465, 587, or 2525");
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: `<pre style="font-family:sans-serif">${text}</pre>`
    });

    return ok({
      message: "SMTP mail sent",
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      smtp: { host, port, user, from, to }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP send failed";
    console.error("[smtp:test-email]", message);
    return fail(message, 502, {
      smtp: { host, port, user, from, to }
    });
  }
}
