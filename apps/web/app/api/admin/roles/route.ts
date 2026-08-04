import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { ROLE_META, ROLE_ORDER, type AppRole } from "../../../../lib/auth/rbac";
import { query, queryOne } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "roles:manage");
  if (error) return error;

  const data = await query<{ id: string; code: AppRole; name: string; description: string | null; is_mvp: boolean; created_at: string }>(
    `select id, code, name, description, is_mvp, created_at
     from roles
     order by created_at asc`
  );

  const sorted = [...data].sort((a, b) => {
    return ROLE_ORDER.indexOf(a.code) - ROLE_ORDER.indexOf(b.code);
  });

  return ok(
    sorted.map((role) => ({
      ...role,
      meta: ROLE_META[role.code] ?? null
    }))
  );
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "users:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    roleCode?: string;
  } | null;

  if (!body?.userId || !body?.roleCode) return fail("userId and roleCode are required");

  const role = await queryOne<{ id: string; code: string }>(
    `select id, code from roles where code = $1`,
    [body.roleCode]
  );

  if (!role) return fail("Role not found", 404);

  await query(
    `insert into user_roles (user_id, role_id)
     values ($1, $2)
     on conflict (user_id, role_id) do nothing`,
    [body.userId, role.id]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "assign_role",
    entityType: "user_roles",
    entityId: body.userId,
    after: { roleCode: body.roleCode }
  });

  return ok({ userId: body.userId, roleCode: body.roleCode }, 201);
}
