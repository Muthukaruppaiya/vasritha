/**
 * Lightweight outbound email helper.
 * Uses SMTP when SMTP_HOST / SMTP_USER / SMTP_PASS are set; otherwise logs to console.
 */
type MailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail(input: MailInput): Promise<{ sent: boolean; skipped?: string }> {
  const to = Array.isArray(input.to) ? input.to.filter(Boolean) : [input.to].filter(Boolean);
  if (!to.length) return { sent: false, skipped: "No recipients" };

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@vasritha.local";
  const port = Number(process.env.SMTP_PORT || 587);

  if (!host || !user || !pass) {
    console.info("[mail:skipped]", {
      to,
      subject: input.subject,
      text: input.text,
      reason: "SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)"
    });
    return { sent: false, skipped: "SMTP not configured" };
  }

  try {
    const nodemailer = await import("nodemailer");
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
