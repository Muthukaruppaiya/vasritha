import { NextRequest } from "next/server";
import { fail, ok } from "../../../../lib/auth/api";
import { requestPasswordReset } from "../../../../lib/password-reset";
import { clientIp, rateLimit, tooManyRequests } from "../../../../lib/security";

export async function POST(request: NextRequest) {
  const limited = rateLimit(`forgot:${clientIp(request)}`, 6, 15 * 60 * 1000);
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  if (!body?.email) return fail("email is required");

  const emailLimited = rateLimit(
    `forgot-email:${String(body.email).trim().toLowerCase()}`,
    4,
    15 * 60 * 1000
  );
  if (!emailLimited.ok) return tooManyRequests(emailLimited.retryAfter);

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    request.nextUrl.origin;

  const result = await requestPasswordReset({
    email: body.email,
    resetUrlBase: site
  });

  if (!result.ok) return fail(result.error, 400);

  return ok({
    sent: result.sent,
    message: result.sent
      ? "If an account exists for that email, a reset link is on its way."
      : result.skipped === "SMTP not configured" || result.skipped === "Email integration disabled"
        ? "Password reset is ready, but email is not configured yet. Ask the shop to enable Email / SMTP."
        : "If an account exists for that email, a reset link is on its way."
  });
}
