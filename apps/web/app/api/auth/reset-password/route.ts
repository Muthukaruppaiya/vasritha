import { NextRequest } from "next/server";
import { fail, ok } from "../../../../lib/auth/api";
import { resetPasswordWithToken } from "../../../../lib/password-reset";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    password?: string;
  } | null;

  if (!body?.token || !body?.password) {
    return fail("token and password are required");
  }

  const result = await resetPasswordWithToken({
    token: body.token,
    password: body.password
  });

  if (!result.ok) return fail(result.error, 400);
  return ok({ reset: true });
}
