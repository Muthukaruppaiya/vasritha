import { NextRequest } from "next/server";
import { fail, ok } from "../../../../lib/auth/api";

/** Local auth: password reset email is not wired; return guidance for temp local setup. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  if (!body?.email) return fail("email is required");

  return ok({
    sent: false,
    mode: "local",
    message:
      "Local PostgreSQL mode: use SQL to reset password_hash with bcrypt, or re-register a test user."
  });
}
