import { NextRequest } from "next/server";
import { fail, ok, requireAuth } from "../../../../lib/auth/api";
import { signAccessToken } from "../../../../lib/db/auth";
import { AppRole, highestRole, permissionsForRoles, ROLE_META } from "../../../../lib/auth/rbac";
import { queryOne } from "../../../../lib/db/pool";

const STAFF_SESSION_SECONDS = 5 * 60;

function isStaffRole(roles: AppRole[]) {
  return roles.some((role) => role !== "customer");
}

/** Sliding refresh for in-store staff while they stay active. */
export async function POST(request: NextRequest) {
  const { error, ctx } = await requireAuth(request);
  if (error || !ctx) return error;

  const roles = (ctx.roles || []) as AppRole[];
  if (!isStaffRole(roles)) {
    return fail("Staff refresh only", 403);
  }

  const profile = await queryOne<{ email: string; full_name: string | null }>(
    `select email, full_name from customers where id = $1`,
    [ctx.userId]
  );
  const email = profile?.email || ctx.email || "";
  if (!email) return fail("User not found", 404);

  const accessToken = await signAccessToken(
    { id: ctx.userId, email },
    `${STAFF_SESSION_SECONDS}s`
  );
  const primary = highestRole(roles);

  return ok({
    user: {
      id: ctx.userId,
      email,
      fullName: profile?.full_name || undefined,
      roles,
      permissions: [...permissionsForRoles(roles)],
      primaryRole: primary,
      primaryRoleName: primary ? ROLE_META[primary].name : null
    },
    session: {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: STAFF_SESSION_SECONDS,
      idle_timeout_seconds: STAFF_SESSION_SECONDS
    }
  });
}
