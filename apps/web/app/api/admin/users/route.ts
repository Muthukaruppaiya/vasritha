import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { createStaffUser } from "../../../../lib/db/auth";
import { query, queryOne } from "../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "users:manage");
  if (error) return error;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? null;
  const like = q ? `%${q}%` : null;

  // Staff directory only — storefront customers live under /admin/customers.
  const users = await query<{
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    created_at: string;
  }>(
    `select u.id, u.full_name, u.email, u.phone, u.created_at
     from users u
     where exists (
       select 1
       from user_roles ur
       join roles r on r.id = ur.role_id
       where ur.user_id = u.id and r.code <> 'customer'
     )
     and ($1::text is null or u.full_name ilike $1 or u.email ilike $1 or u.phone ilike $1)
     order by u.created_at desc
     limit 100`,
    [like]
  );

  const userIds = users.map((u) => u.id);
  const roleRows = userIds.length
    ? await query<{ user_id: string; code: string; name: string }>(
        `select ur.user_id, r.code, r.name
         from user_roles ur
         join roles r on r.id = ur.role_id
         where ur.user_id = any($1::uuid[])
         order by r.name asc`,
        [userIds]
      )
    : [];

  const data = users.map((user) => {
    const roles = roleRows.filter((row) => row.user_id === user.id);
    return {
      ...user,
      roles: roles.map((r) => ({ code: r.code, name: r.name })),
      primaryRoleName: roles[0]?.name ?? "No role"
    };
  });

  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "users:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    fullName?: string;
    phone?: string;
    roleCode?: string;
  } | null;

  if (!body?.email || !body?.password || !body?.fullName || !body?.roleCode) {
    return fail("email, password, fullName and roleCode are required");
  }

  if (body.password.length < 6) return fail("password must be at least 6 characters");

  const role = await queryOne<{ id: string; code: string; name: string }>(
    `select id, code, name from roles where code = $1`,
    [body.roleCode]
  );
  if (!role) return fail("Role not found", 404);
  if (role.code === "customer") {
    return fail("Use the Customers area for storefront shoppers; staff users need an admin role");
  }

  const existing = await queryOne(`select id from users where email = $1`, [
    body.email.toLowerCase()
  ]);
  if (existing) return fail("A user with this email already exists", 409);

  try {
    const user = await createStaffUser({
      email: body.email,
      password: body.password,
      fullName: body.fullName,
      phone: body.phone,
      roleCode: body.roleCode
    });

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "create",
      entityType: "users",
      entityId: user.id,
      after: { email: user.email, roleCode: body.roleCode }
    });

    return ok(
      {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: { code: role.code, name: role.name }
      },
      201
    );
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to create user", 400);
  }
}

export async function PATCH(request: NextRequest) {
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
  if (role.code === "customer") {
    return fail("Cannot assign the customer role from the staff Users page");
  }

  const user = await queryOne(`select id from users where id = $1`, [body.userId]);
  if (!user) return fail("User not found", 404);

  await query(`delete from user_roles where user_id = $1`, [body.userId]);
  await query(
    `insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`,
    [body.userId, role.id]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "assign_role",
    entityType: "users",
    entityId: body.userId,
    after: { roleCode: body.roleCode }
  });

  return ok({ userId: body.userId, roleCode: body.roleCode });
}
