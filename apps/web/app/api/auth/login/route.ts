import { NextRequest } from "next/server";
import { fail, ok } from "../../../../lib/auth/api";
import { getUserRoles, signAccessToken, verifyUser } from "../../../../lib/db/auth";
import { AppRole, highestRole, permissionsForRoles, ROLE_META } from "../../../../lib/auth/rbac";
import {
  assertLoginNotLocked,
  assertStaffLoginSecurity,
  clearLoginFailures,
  recordLoginFailure
} from "../../../../lib/login-security";
import { recordLoginEvent } from "../../../../lib/login-events";
import { getUserShopProfile } from "../../../../lib/shop-scope";
import { clientIp, rateLimit, tooManyRequests } from "../../../../lib/security";

/** In-store staff sessions expire after 5 minutes of idle time (JWT matches). */
const STAFF_SESSION_SECONDS = 5 * 60;
const CUSTOMER_SESSION_SECONDS = 60 * 60 * 24 * 7;

/** Admins can sign in from anywhere; store login security applies to other staff only. */
const LOGIN_SECURITY_EXEMPT_ROLES: AppRole[] = ["super_admin", "business_owner"];

function isStaffRole(roles: AppRole[]) {
  return roles.some((role) => role !== "customer");
}

function isLoginSecurityExempt(roles: AppRole[]) {
  return roles.some((role) => LOGIN_SECURITY_EXEMPT_ROLES.includes(role));
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    /** staff | pos → apply login security. website/omitted → never. */
    client?: string;
    deviceKey?: string;
    deviceLabel?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;

  if (!body?.email || !body?.password) return fail("email and password are required");

  const ipLimited = rateLimit(`login:${clientIp(request)}`, 25, 15 * 60 * 1000);
  if (!ipLimited.ok) return tooManyRequests(ipLimited.retryAfter);

  const email = String(body.email).trim().toLowerCase();
  const emailLimited = rateLimit(`login-email:${email}`, 12, 15 * 60 * 1000);
  if (!emailLimited.ok) return tooManyRequests(emailLimited.retryAfter);

  const lock = await assertLoginNotLocked(email);
  if (!lock.ok) {
    return tooManyRequests(lock.retryAfter, lock.error);
  }

  const loginClient = String(body.client || "website").toLowerCase();
  const logBase = {
    request,
    email,
    client: loginClient,
    deviceKey: body.deviceKey,
    deviceLabel: body.deviceLabel,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null
  };

  const user = await verifyUser(email, body.password);
  if (!user) {
    const failed = await recordLoginFailure(email);
    await recordLoginEvent({
      ...logBase,
      success: false,
      failureCode: failed.locked ? "account_locked" : "invalid_credentials",
      failureMessage: failed.locked ? failed.error : "Invalid email or password"
    });
    if (failed.locked) return tooManyRequests(failed.retryAfter, failed.error);
    return fail("Invalid email or password", 401);
  }

  let roles = await getUserRoles(user.id);
  if (!roles.length) roles = ["customer"];
  const typedRoles = roles as AppRole[];
  const primary = highestRole(typedRoles);
  const staff = isStaffRole(typedRoles);
  const isOpsLogin = loginClient === "staff" || loginClient === "pos";

  await clearLoginFailures(email);

  // Login security is only for POS / staff ops domain — never for public website shoppers.
  if (staff && isOpsLogin && !isLoginSecurityExempt(typedRoles)) {
    const security = await assertStaffLoginSecurity({
      request,
      client: loginClient,
      deviceKey: body.deviceKey,
      deviceLabel: body.deviceLabel,
      userAgent: request.headers.get("user-agent"),
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null
    });
    if (!security.ok) {
      await recordLoginEvent({
        ...logBase,
        userId: user.id,
        success: false,
        failureCode: security.code || "security_blocked",
        failureMessage: security.error,
        roles: typedRoles
      });
      return fail(security.error, 403, { code: security.code });
    }
  }

  const expiresInSeconds = staff ? STAFF_SESSION_SECONDS : CUSTOMER_SESSION_SECONDS;
  const accessToken = await signAccessToken(
    { id: user.id, email: user.email },
    staff ? `${STAFF_SESSION_SECONDS}s` : `${CUSTOMER_SESSION_SECONDS}s`
  );

  await recordLoginEvent({
    ...logBase,
    userId: user.id,
    success: true,
    roles: typedRoles
  });

  const shopProfile = staff ? await getUserShopProfile(user.id) : null;

  return ok({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      roles: typedRoles,
      permissions: [...permissionsForRoles(typedRoles)],
      primaryRole: primary,
      primaryRoleName: primary ? ROLE_META[primary].name : null,
      shopId: shopProfile?.shop_id ?? null,
      shopName: shopProfile?.shop_name ?? null,
      shopCode: shopProfile?.shop_code ?? null
    },
    session: {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: expiresInSeconds,
      idle_timeout_seconds: staff ? STAFF_SESSION_SECONDS : null
    }
  });
}
