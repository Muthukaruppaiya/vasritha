import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { ROLE_META, ROLE_ORDER, type AppRole } from "../../../../lib/auth/rbac";
import { query, queryOne } from "../../../../lib/db/pool";

function slugRoleCode(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, ["roles:manage", "users:manage"]);
  if (error) return error;

  const data = await query<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    is_mvp: boolean;
    is_system: boolean;
    permission_template: string | null;
    created_at: string;
  }>(
    `select id, code, name, description, is_mvp,
            coalesce(is_system, false) as is_system,
            permission_template, created_at
     from roles
     order by created_at asc`
  );

  const sorted = [...data].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.code as AppRole);
    const bi = ROLE_ORDER.indexOf(b.code as AppRole);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return ok(
    sorted.map((role) => ({
      ...role,
      meta: ROLE_META[role.code as AppRole] ?? null
    }))
  );
}

/** Create a custom role (or register a named role with a permission template). */
export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "roles:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    code?: string;
    name?: string;
    description?: string;
    permissionTemplate?: string;
  } | null;

  if (!body?.name) return fail("name is required");

  const code = slugRoleCode(body.code || body.name);
  if (!code) return fail("valid code is required");

  const template = body.permissionTemplate || "manager";
  if (!(template in ROLE_META)) {
    return fail("permissionTemplate must be a known system role");
  }

  const existing = await queryOne(`select id from roles where code = $1`, [code]);
  if (existing) return fail("A role with this code already exists", 409);

  const data = await queryOne(
    `insert into roles (code, name, description, is_mvp, is_system, permission_template)
     values ($1, $2, $3, true, false, $4)
     returning *`,
    [code, body.name.trim(), body.description ?? null, template]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "roles",
    entityId: (data as { id: string }).id,
    after: data
  });

  return ok(data, 201);
}
