import { NextRequest } from "next/server";
import { fail, ok } from "../../../../lib/auth/api";
import { getUserRoles, signAccessToken, verifyUser } from "../../../../lib/db/auth";
import { AppRole, highestRole, ROLE_META } from "../../../../lib/auth/rbac";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  if (!body?.email || !body?.password) return fail("email and password are required");

  const user = await verifyUser(body.email, body.password);
  if (!user) return fail("Invalid email or password", 401);

  let roles = await getUserRoles(user.id);
  if (!roles.length) roles = ["customer"];
  const primary = highestRole(roles as AppRole[]);
  const accessToken = await signAccessToken({ id: user.id, email: user.email });

  return ok({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      roles,
      primaryRole: primary,
      primaryRoleName: primary ? ROLE_META[primary].name : null
    },
    session: {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 60 * 60 * 24 * 7
    }
  });
}
