import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { query, queryOne } from "./pool";
import type { AppRole } from "../auth/rbac";
import { ROLE_META } from "../auth/rbac";

const JWT_SECRET = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || "vasritha-local-dev-secret-change-me");

export type DbUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  password_hash: string;
};

export async function createUser(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await queryOne<DbUser>(
    `insert into users (email, password_hash, full_name, phone)
     values ($1, $2, $3, $4)
     returning id, email, full_name, phone, password_hash`,
    [input.email.toLowerCase(), passwordHash, input.fullName, input.phone ?? null]
  );
  if (!user) throw new Error("Failed to create user");

  await query(
    `insert into customers (id, full_name, email, phone) values ($1, $2, $3, $4)
     on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone`,
    [user.id, input.fullName, input.email.toLowerCase(), input.phone ?? null]
  );

  const role = await queryOne<{ id: string }>(`select id from roles where code = 'customer'`);
  if (role) {
    await query(
      `insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`,
      [user.id, role.id]
    );
  }

  return user;
}

export async function verifyUser(email: string, password: string) {
  const user = await queryOne<DbUser>(
    `select id, email, full_name, phone, password_hash from users where email = $1`,
    [email.toLowerCase()]
  );
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return user;
}

export async function getUserById(id: string) {
  return queryOne<Omit<DbUser, "password_hash"> & { password_hash?: string }>(
    `select id, email, full_name, phone from users where id = $1`,
    [id]
  );
}

export async function getUserRoles(userId: string): Promise<AppRole[]> {
  const rows = await query<{ code: string; permission_template: string | null }>(
    `select r.code, r.permission_template
     from user_roles ur
     join roles r on r.id = ur.role_id
     where ur.user_id = $1`,
    [userId]
  );

  const known = new Set(Object.keys(ROLE_META) as AppRole[]);
  const effective = new Set<AppRole>();

  for (const row of rows) {
    if (known.has(row.code as AppRole)) {
      effective.add(row.code as AppRole);
      continue;
    }
    const template = row.permission_template;
    if (template && known.has(template as AppRole)) {
      effective.add(template as AppRole);
    }
  }

  return [...effective];
}

export async function getUserRoleLabels(userId: string) {
  return query<{ code: string; name: string }>(
    `select r.code, r.name
     from user_roles ur
     join roles r on r.id = ur.role_id
     where ur.user_id = $1
     order by r.name asc`,
    [userId]
  );
}

export async function createStaffUser(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  roleCode: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await queryOne<DbUser>(
    `insert into users (email, password_hash, full_name, phone)
     values ($1, $2, $3, $4)
     returning id, email, full_name, phone, password_hash`,
    [input.email.toLowerCase(), passwordHash, input.fullName, input.phone ?? null]
  );
  if (!user) throw new Error("Failed to create user");

  // Keep a customer profile row for shared identity, but role is staff/system as assigned.
  await query(
    `insert into customers (id, full_name, email, phone) values ($1, $2, $3, $4)
     on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone`,
    [user.id, input.fullName, input.email.toLowerCase(), input.phone ?? null]
  );

  await assignRole(user.id, input.roleCode);
  return user;
}

export async function updateStaffUser(input: {
  userId: string;
  fullName?: string;
  email?: string;
  phone?: string | null;
  password?: string;
  roleCode?: string;
}) {
  const existing = await queryOne<{
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
  }>(`select id, email, full_name, phone from users where id = $1`, [input.userId]);
  if (!existing) throw new Error("User not found");

  const fullName = (input.fullName ?? existing.full_name).trim();
  const email = (input.email ?? existing.email).trim().toLowerCase();
  const phone =
    input.phone === undefined ? existing.phone : input.phone?.trim() ? input.phone.trim() : null;

  if (!fullName) throw new Error("Full name is required");
  if (!email) throw new Error("Email is required");

  if (email !== existing.email) {
    const clash = await queryOne(`select id from users where email = $1 and id <> $2`, [
      email,
      input.userId
    ]);
    if (clash) throw new Error("A user with this email already exists");
  }

  if (input.password) {
    if (input.password.length < 6) throw new Error("Password must be at least 6 characters");
    const passwordHash = await bcrypt.hash(input.password, 10);
    await query(
      `update users
       set full_name = $2, email = $3, phone = $4, password_hash = $5, updated_at = now()
       where id = $1`,
      [input.userId, fullName, email, phone, passwordHash]
    );
  } else {
    await query(
      `update users
       set full_name = $2, email = $3, phone = $4, updated_at = now()
       where id = $1`,
      [input.userId, fullName, email, phone]
    );
  }

  await query(
    `insert into customers (id, full_name, email, phone) values ($1, $2, $3, $4)
     on conflict (id) do update
       set full_name = excluded.full_name, email = excluded.email, phone = excluded.phone`,
    [input.userId, fullName, email, phone]
  );

  if (input.roleCode) {
    if (input.roleCode === "customer") {
      throw new Error("Cannot assign the customer role from the staff Users page");
    }
    const role = await queryOne<{ id: string; code: string }>(
      `select id, code from roles where code = $1`,
      [input.roleCode]
    );
    if (!role) throw new Error("Role not found");
    await query(
      `delete from user_roles ur
       using roles r
       where ur.role_id = r.id and ur.user_id = $1 and r.code <> 'customer'`,
      [input.userId]
    );
    await query(
      `insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`,
      [input.userId, role.id]
    );
  }

  return { id: input.userId, email, full_name: fullName, phone };
}

export async function deleteStaffUser(userId: string, actorUserId: string) {
  if (userId === actorUserId) {
    throw new Error("You cannot delete your own account");
  }

  const user = await queryOne(`select id from users where id = $1`, [userId]);
  if (!user) throw new Error("User not found");

  const isSuperAdmin = await queryOne(
    `select 1 as ok
     from user_roles ur
     join roles r on r.id = ur.role_id
     where ur.user_id = $1 and r.code = 'super_admin'
     limit 1`,
    [userId]
  );
  if (isSuperAdmin) {
    const otherAdmins = await queryOne<{ count: string }>(
      `select count(*)::text as count
       from user_roles ur
       join roles r on r.id = ur.role_id
       where r.code = 'super_admin' and ur.user_id <> $1`,
      [userId]
    );
    if (Number(otherAdmins?.count || 0) < 1) {
      throw new Error("Cannot delete the last Super Admin");
    }
  }

  await query(
    `delete from user_roles ur
     using roles r
     where ur.role_id = r.id and ur.user_id = $1 and r.code <> 'customer'`,
    [userId]
  );

  const hasOrders = await queryOne(
    `select 1 as ok from orders where customer_id = $1 limit 1`,
    [userId]
  );
  if (hasOrders) {
    const customerRole = await queryOne<{ id: string }>(
      `select id from roles where code = 'customer'`
    );
    if (customerRole) {
      await query(
        `insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`,
        [userId, customerRole.id]
      );
    }
    return { deleted: false, demoted: true, userId };
  }

  await query(`delete from user_roles where user_id = $1`, [userId]);
  await query(`delete from customers where id = $1`, [userId]);
  await query(`delete from users where id = $1`, [userId]);
  return { deleted: true, demoted: false, userId };
}

export async function assignRole(userId: string, roleCode: string) {
  const role = await queryOne<{ id: string }>(`select id from roles where code = $1`, [roleCode]);
  if (!role) throw new Error("Role not found");
  await query(
    `insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`,
    [userId, role.id]
  );
}

export async function signAccessToken(
  user: { id: string; email: string },
  expiresIn: string | number = "7d"
) {
  return new SignJWT({ sub: user.id, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET());
}

export async function verifyAccessToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET());
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!userId) return null;
    return { userId, email };
  } catch {
    return null;
  }
}
