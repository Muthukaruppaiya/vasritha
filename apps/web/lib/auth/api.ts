import { NextResponse } from "next/server";
import {
  AppRole,
  Permission,
  hasPermission,
  highestRole,
  permissionsForRoles,
  ROLE_META
} from "./rbac";
import { getUserById, getUserRoles, verifyAccessToken } from "../db/auth";
import { query } from "../db/pool";

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

export function cachedOk<T>(data: T, maxAgeSeconds = 30) {
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

  const user = await getUserById(token.userId);
  if (!user) return null;

  let roles = await getUserRoles(user.id);
  if (roles.length === 0) roles = ["customer"];

  return {
    userId: user.id,
    email: user.email,
    roles,
    primaryRole: highestRole(roles),
    permissions: [...permissionsForRoles(roles)]
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
