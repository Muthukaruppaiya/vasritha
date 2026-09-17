import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";
import { ensureLoginSecuritySchema } from "../../../../../lib/login-security";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "settings:business");
  if (error) return error;
  await ensureLoginSecuritySchema();
  const data = await query(
    `select id, device_key, label, user_agent, last_ip, status, last_seen_at, created_at, updated_at
     from staff_login_devices
     order by
       case status when 'pending' then 0 when 'approved' then 1 else 2 end,
       updated_at desc`
  );
  return ok(data);
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;
  await ensureLoginSecuritySchema();

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: string;
    label?: string;
  } | null;

  if (!body?.id) return fail("id is required");
  const status = String(body.status || "").toLowerCase();
  if (!["pending", "approved", "blocked"].includes(status) && body.status !== undefined) {
    return fail("status must be pending, approved, or blocked");
  }

  const before = await queryOne(`select * from staff_login_devices where id = $1`, [body.id]);
  if (!before) return fail("Device not found", 404);

  const data = await queryOne(
    `update staff_login_devices
     set status = coalesce($2, status),
         label = coalesce($3, label),
         updated_at = now()
     where id = $1
     returning *`,
    [body.id, body.status ?? null, body.label ?? null]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "staff_login_devices",
    entityId: body.id,
    before,
    after: data
  });
  return ok(data);
}

export async function DELETE(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;
  await ensureLoginSecuritySchema();

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("id is required");

  const before = await queryOne(`select * from staff_login_devices where id = $1`, [id]);
  if (!before) return fail("Device not found", 404);

  await query(`delete from staff_login_devices where id = $1`, [id]);
  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "delete",
    entityType: "staff_login_devices",
    entityId: id,
    before
  });
  return ok({ deleted: id });
}
