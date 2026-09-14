import { NextResponse } from "next/server";
import {
  AppRole,
  Permission,
  hasPermission,
  highestRole,
  permissionsForRoles,
  ROLE_META
} from "./rbac";
import { verifyAccessToken } from "../db/auth";
import { query, queryOne } from "../db/pool";

export type AuthContext = {
  userId: string;
  email: string | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  permissions: Permission[];
};

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function ok<T>(data: T, status = 200, headers?: HeadersInit) {
  return NextResponse.json({ data }, { status, headers });
}

export function cachedOk<T>(data: T, maxAgeSeconds = 120) {
  return ok(data, 200, {
    "Cache-Control": `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 4}`
  });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return jsonError(message, status, extra);
}

export async function getAuthContext(request: Request): Promise<AuthContext | null> {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearer) return null;

  const token = await verifyAccessToken(bearer);
  if (!token) return null;

  // One round-trip instead of user + roles sequential queries (critical with remote DB).
  const row = await queryOne<{
    id: string;
    email: string | null;
    role_codes: string[] | null;
    role_templates: string[] | null;
  }>(
    `select u.id, u.email,
            coalesce(array_agg(r.code) filter (where r.code is not null), '{}') as role_codes,
            coalesce(array_agg(r.permission_template) filter (where r.permission_template is not null), '{}') as role_templates
     from users u
     left join user_roles ur on ur.user_id = u.id
     left join roles r on r.id = ur.role_id
     where u.id = $1
     group by u.id`,
    [token.userId]
  );
  if (!row) return null;

  const known = new Set(Object.keys(ROLE_META) as AppRole[]);
  const roles = new Set<AppRole>();
  for (const code of row.role_codes ?? []) {
    if (known.has(code as AppRole)) roles.add(code as AppRole);
  }
  for (const template of row.role_templates ?? []) {
    if (known.has(template as AppRole)) roles.add(template as AppRole);
  }
  const resolved = roles.size ? [...roles] : (["customer"] as AppRole[]);

  return {
    userId: row.id,
    email: row.email,
    roles: resolved,
    primaryRole: highestRole(resolved),
    permissions: [...permissionsForRoles(resolved)]
  };
}

export async function requireAuth(request: Request) {
  const ctx = await getAuthContext(request);
  if (!ctx) return { error: fail("Unauthorized", 401) as NextResponse, ctx: null };
  return { error: null, ctx };
}

export async function requirePermission(request: Request, permission: Permission) {
  const { error, ctx } = await requireAuth(request);
  if (error || !ctx) return { error: error ?? fail("Unauthorized", 401), ctx: null };

  if (!hasPermission(ctx.roles, permission)) {
    return {
      error: fail("Forbidden for your role", 403, {
        required: permission,
        role: ctx.primaryRole,
        roleName: ctx.primaryRole ? ROLE_META[ctx.primaryRole].name : null
      }),
      ctx: null
    };
  }

  return { error: null, ctx };
}

export async function requireAnyPermission(request: Request, permissions: Permission[]) {
  const { error, ctx } = await requireAuth(request);
  if (error || !ctx) return { error: error ?? fail("Unauthorized", 401), ctx: null };

  const allowed = permissions.some((permission) => hasPermission(ctx.roles, permission));
  if (!allowed) {
    return {
      error: fail("Forbidden for your role", 403, {
        requiredAny: permissions,
        role: ctx.primaryRole
      }),
      ctx: null
    };
  }

  return { error: null, ctx };
}

export async function writeAuditLog(input: {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}) {
  await query(
    `insert into audit_logs (actor_user_id, action, entity_type, entity_id, before, after)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [
      input.actorUserId,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null
    ]
  );
}
