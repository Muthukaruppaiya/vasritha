import { NextRequest } from "next/server";
import { fail, ok, requireAuth } from "../../../../lib/auth/api";
import { ROLE_META } from "../../../../lib/auth/rbac";
import { queryOne } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error, ctx } = await requireAuth(request);
  if (error || !ctx) return error;

  const profile = await queryOne(
    `select id, full_name, email, phone, created_at from customers where id = $1`,
    [ctx.userId]
  );

  return ok({
    id: ctx.userId,
    email: ctx.email,
    roles: ctx.roles,
    primaryRole: ctx.primaryRole,
    primaryRoleName: ctx.primaryRole ? ROLE_META[ctx.primaryRole].name : null,
    permissions: ctx.permissions,
    profile,
    roleMeta: ctx.roles.map((role) => ({
      code: role,
      ...ROLE_META[role]
    }))
  });
}
