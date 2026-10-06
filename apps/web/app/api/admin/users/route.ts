import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import {
  createStaffUser,
  deleteStaffUser,
  updateStaffUser
} from "../../../../lib/db/auth";
import { query, queryOne } from "../../../../lib/db/pool";
import { ensureShopStockSchema, roleRequiresShop } from "../../../../lib/shop-scope";
import { getShopById } from "../../../../lib/shops";
import {
  firstError,
  normalizeEmail,
  normalizePhone10,
  validateEmail,
  validatePassword,
  validatePhone10,
  validateRequired
} from "../../../../lib/validation";

async function validateShopForRole(roleCode: string, shopId: string | null | undefined) {
  if (roleRequiresShop(roleCode)) {
    if (!shopId) {
      return "Store is required for this staff role";
    }
    const shop = await getShopById(shopId);
    if (!shop || !shop.is_active) return "Select an active store";
  } else if (shopId) {
    const shop = await getShopById(shopId);
    if (!shop || !shop.is_active) return "Select an active store";
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "users:manage");
  if (error) return error;

  await ensureShopStockSchema();

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? null;
  const like = q ? `%${q}%` : null;

  // Staff directory only — storefront customers live under /admin/customers.
  const users = await query<{
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    shop_id: string | null;
    shop_name: string | null;
    shop_code: string | null;
    created_at: string;
  }>(
    `select u.id, u.full_name, u.email, u.phone, u.shop_id,
            s.name as shop_name, s.code as shop_code, u.created_at
     from users u
     left join shops s on s.id = u.shop_id
     where exists (
       select 1
       from user_roles ur
       join roles r on r.id = ur.role_id
       where ur.user_id = u.id and r.code <> 'customer'
     )
     and ($1::text is null or u.full_name ilike $1 or u.email ilike $1 or u.phone ilike $1
          or coalesce(s.name, '') ilike $1 or coalesce(s.code, '') ilike $1)
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

  await ensureShopStockSchema();

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    fullName?: string;
    phone?: string;
    roleCode?: string;
    shopId?: string | null;
  } | null;

  if (!body?.email || !body?.password || !body?.fullName || !body?.roleCode) {
    return fail("email, password, fullName and roleCode are required");
  }

  const fieldError = firstError(
    validateRequired(body.fullName, "Full name"),
    validateEmail(body.email, { required: true }),
    validatePassword(body.password, { required: true }),
    validatePhone10(body.phone, { required: false })
  );
  if (fieldError) return fail(fieldError);

  const role = await queryOne<{ id: string; code: string; name: string }>(
    `select id, code, name from roles where code = $1`,
    [body.roleCode]
  );
  if (!role) return fail("Role not found", 404);
  if (role.code === "customer") {
    return fail("Use the Customers area for storefront shoppers; staff users need an admin role");
  }

  const shopId = body.shopId ? String(body.shopId) : null;
  const shopError = await validateShopForRole(role.code, shopId);
  if (shopError) return fail(shopError);

  const email = normalizeEmail(body.email);
  const phone = normalizePhone10(body.phone) || undefined;

  const existing = await queryOne(`select id from users where email = $1`, [email]);
  if (existing) return fail("A user with this email already exists", 409);

  try {
    const user = await createStaffUser({
      email,
      password: body.password,
      fullName: String(body.fullName).trim(),
      phone,
      roleCode: body.roleCode,
      shopId: roleRequiresShop(role.code) ? shopId : shopId
    });

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "create",
      entityType: "users",
      entityId: user.id,
      after: { email: user.email, roleCode: body.roleCode, shopId }
    });

    return ok(
      {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        shopId,
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

  await ensureShopStockSchema();

  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    roleCode?: string;
    fullName?: string;
    email?: string;
    phone?: string | null;
    password?: string;
    shopId?: string | null;
  } | null;

  if (!body?.userId) return fail("userId is required");

  const hasProfileEdit =
    body.fullName !== undefined ||
    body.email !== undefined ||
    body.phone !== undefined ||
    body.password !== undefined ||
    body.shopId !== undefined;

  // Quick role-only change (legacy table dropdown)
  if (!hasProfileEdit && body.roleCode) {
    const role = await queryOne<{ id: string; code: string }>(
      `select id, code from roles where code = $1`,
      [body.roleCode]
    );
    if (!role) return fail("Role not found", 404);
    if (role.code === "customer") {
      return fail("Cannot assign the customer role from the staff Users page");
    }

    const user = await queryOne<{ shop_id: string | null }>(
      `select shop_id from users where id = $1`,
      [body.userId]
    );
    if (!user) return fail("User not found", 404);

    const shopError = await validateShopForRole(role.code, user.shop_id);
    if (shopError) return fail(`${shopError}. Edit the user and assign a store.`);

    await query(
      `delete from user_roles ur
       using roles r
       where ur.role_id = r.id and ur.user_id = $1 and r.code <> 'customer'`,
      [body.userId]
    );
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

  try {
    const fieldError = firstError(
      body.fullName !== undefined ? validateRequired(body.fullName, "Full name") : null,
      body.email !== undefined ? validateEmail(body.email, { required: true }) : null,
      body.phone !== undefined ? validatePhone10(body.phone, { required: false }) : null,
      body.password !== undefined && body.password
        ? validatePassword(body.password, { required: true })
        : null
    );
    if (fieldError) return fail(fieldError);

    const nextRole = body.roleCode;
    if (nextRole || body.shopId !== undefined) {
      const roleCode =
        nextRole ||
        (
          await queryOne<{ code: string }>(
            `select r.code from user_roles ur
             join roles r on r.id = ur.role_id
             where ur.user_id = $1 and r.code <> 'customer'
             order by r.name asc limit 1`,
            [body.userId]
          )
        )?.code;
      if (roleCode) {
        const existingShop = await queryOne<{ shop_id: string | null }>(
          `select shop_id from users where id = $1`,
          [body.userId]
        );
        const shopId =
          body.shopId !== undefined ? body.shopId : existingShop?.shop_id ?? null;
        const shopError = await validateShopForRole(roleCode, shopId);
        if (shopError) return fail(shopError);
      }
    }

    const updated = await updateStaffUser({
      userId: body.userId,
      fullName: body.fullName !== undefined ? String(body.fullName).trim() : undefined,
      email: body.email !== undefined ? normalizeEmail(body.email) : undefined,
      phone:
        body.phone !== undefined
          ? normalizePhone10(body.phone) || null
          : undefined,
      password: body.password,
      roleCode: body.roleCode,
      shopId: body.shopId
    });

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "update",
      entityType: "users",
      entityId: body.userId,
      after: {
        email: updated.email,
        fullName: updated.full_name,
        phone: updated.phone,
        shopId: updated.shop_id,
        roleCode: body.roleCode || undefined,
        passwordChanged: Boolean(body.password)
      }
    });

    return ok(updated);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to update user", 400);
  }
}

export async function DELETE(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "users:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as { userId?: string } | null;
  const userId =
    body?.userId || new URL(request.url).searchParams.get("userId") || undefined;
  if (!userId) return fail("userId is required");

  try {
    const result = await deleteStaffUser(userId, ctx.userId);
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: result.deleted ? "delete" : "demote",
      entityType: "users",
      entityId: userId,
      after: result
    });
    return ok(result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to delete user", 400);
  }
}
