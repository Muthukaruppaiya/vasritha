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

export async function assignRole(userId: string, roleCode: string) {
  const role = await queryOne<{ id: string }>(`select id from roles where code = $1`, [roleCode]);
  if (!role) throw new Error("Role not found");
  await query(
    `insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`,
    [userId, role.id]
  );
}

export async function signAccessToken(user: { id: string; email: string }) {
  return new SignJWT({ sub: user.id, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
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
