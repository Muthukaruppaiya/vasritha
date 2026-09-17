import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../../lib/auth/api";
import { getIntegration, type EmailConfig } from "../../../../../lib/integrations";
import { sendMail } from "../../../../../lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/integrations/test-email
 * Body: { "to": "you@example.com" }
 * Sends a real SMTP test using Admin → Integrations → Email settings (or SMTP_* env).
 */
export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as { to?: unknown } | null;
  const to = String(body?.to || "").trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return fail("Provide a valid to email, e.g. { \"to\": \"you@gmail.com\" }");
  }

  const integration = await getIntegration<EmailConfig>("email").catch(() => null);
  if (integration && !integration.is_enabled) {
    return fail(
      "Email (SMTP) is disabled. Open Admin → Integrations → Email, enable it, save, then retry.",
      400
    );
  }

  const cfg = integration?.config || {};
  const host = String(cfg.host || process.env.SMTP_HOST || "");
  const user = String(cfg.user || process.env.SMTP_USER || "");
  const hasPass = Boolean(String(cfg.pass || process.env.SMTP_PASS || "").trim());
  const port = Number(cfg.port || process.env.SMTP_PORT || 587);
  const from = String(cfg.from || process.env.SMTP_FROM || user || "");

  if (!host || !user || !hasPass) {
    return fail(
      "SMTP not configured. Set host, user, App Password, and from in Admin → Integrations → Email (or SMTP_* on Vercel).",
      400
    );
  }

  const now = new Date();
  const stamp = now.toISOString();
  const result = await sendMail({
    to,
    subject: `Vasritha SMTP test · ${stamp}`,
    text: [
      "Vasritha SMTP test email",
      "",
      `Sent at: ${stamp}`,
      `To: ${to}`,
      `From: ${from}`,
      `SMTP host: ${host}`,
      `SMTP port: ${port}`,
      `SMTP user: ${user}`,
      "",
      "If you received this, Gmail App Password + SMTP are working."
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;line-height:1.5;color:#3d241c">
        <h2 style="margin:0 0 8px">Vasritha SMTP test</h2>
        <p>If you received this, Gmail App Password + SMTP are working.</p>
        <ul>
          <li><b>Sent at:</b> ${stamp}</li>
          <li><b>To:</b> ${to}</li>
          <li><b>From:</b> ${from}</li>
          <li><b>SMTP:</b> ${host}:${port} as ${user}</li>
        </ul>
      </div>
    `
  });

  if (!result.sent) {
    return fail(result.skipped || "SMTP send failed", 502, {
      smtp: { host, port, user, from, enabled: Boolean(integration?.is_enabled ?? true) }
    });
  }

  return ok({
    message: "Test email sent. Check inbox (and Spam).",
    to,
    smtp: { host, port, user, from, enabled: Boolean(integration?.is_enabled ?? true) },
    sentAt: stamp
  });
}
