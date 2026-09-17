import { query, queryOne } from "./db/pool";
import { classifyHost } from "./hosts";

export type LoginSecurityConfig = {
  enabled: boolean;
  requireIp: boolean;
  requireDevice: boolean;
  requireGeo: boolean;
  allowedIps: string[];
  storeLat: number | null;
  storeLng: number | null;
  storeRadiusM: number;
};

export type StaffLoginClient = "staff" | "pos" | "website" | "unknown";

let schemaReady: Promise<void> | null = null;

export async function ensureLoginSecuritySchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`
        alter table site_settings
          add column if not exists staff_login_security_enabled boolean not null default false,
          add column if not exists staff_login_require_ip boolean not null default false,
          add column if not exists staff_login_require_device boolean not null default false,
          add column if not exists staff_login_require_geo boolean not null default false,
          add column if not exists staff_login_allowed_ips text not null default '',
          add column if not exists staff_login_store_lat numeric(10,7),
          add column if not exists staff_login_store_lng numeric(10,7),
          add column if not exists staff_login_store_radius_m integer not null default 300
      `);
      await query(`
        create table if not exists public.staff_login_devices (
          id uuid primary key default gen_random_uuid(),
          device_key text not null unique,
          label text,
          user_agent text,
          last_ip text,
          status text not null default 'pending'
            check (status in ('pending', 'approved', 'blocked')),
          last_seen_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      await query(`
        create index if not exists staff_login_devices_status_idx
          on public.staff_login_devices (status)
      `);
    })();
  }
  await schemaReady;
}

function parseIpList(raw: string | null | undefined) {
  return String(raw || "")
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function getLoginSecurityConfig(): Promise<LoginSecurityConfig> {
  await ensureLoginSecuritySchema();
  const row = await queryOne<{
    staff_login_security_enabled?: boolean;
    staff_login_require_ip?: boolean;
    staff_login_require_device?: boolean;
    staff_login_require_geo?: boolean;
    staff_login_allowed_ips?: string | null;
    staff_login_store_lat?: string | number | null;
    staff_login_store_lng?: string | number | null;
    staff_login_store_radius_m?: number | null;
  }>(`select * from site_settings limit 1`);

  return {
    enabled: Boolean(row?.staff_login_security_enabled),
    requireIp: Boolean(row?.staff_login_require_ip),
    requireDevice: Boolean(row?.staff_login_require_device),
    requireGeo: Boolean(row?.staff_login_require_geo),
    allowedIps: parseIpList(row?.staff_login_allowed_ips),
    storeLat: row?.staff_login_store_lat != null ? Number(row.staff_login_store_lat) : null,
    storeLng: row?.staff_login_store_lng != null ? Number(row.staff_login_store_lng) : null,
    storeRadiusM: Math.max(50, Number(row?.staff_login_store_radius_m || 300))
  };
}

export function clientIpFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return "";
}

function ipMatches(allowed: string, actual: string) {
  if (!allowed || !actual) return false;
  if (allowed === actual) return true;
  // Simple prefix allow: 103.94.27.
  if (allowed.endsWith(".") && actual.startsWith(allowed)) return true;
  // CIDR /24 style: 103.94.27.0/24
  const cidr = allowed.match(/^(\d+\.\d+\.\d+)\.0\/24$/);
  if (cidr) return actual.startsWith(`${cidr[1]}.`);
  return false;
}

export function isIpAllowed(allowedIps: string[], actualIp: string) {
  if (!allowedIps.length) return false;
  return allowedIps.some((entry) => ipMatches(entry, actualIp));
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export function isWithinStoreGeo(
  config: LoginSecurityConfig,
  latitude: number | null | undefined,
  longitude: number | null | undefined
) {
  if (config.storeLat == null || config.storeLng == null) return false;
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  const distance = haversineMeters(config.storeLat, config.storeLng, latitude, longitude);
  return distance <= config.storeRadiusM;
}

export async function assertStaffLoginSecurity(input: {
  request: Request;
  /** Only staff/POS login UI should pass staff|pos. Website must never. */
  client?: string | null;
  deviceKey?: string | null;
  deviceLabel?: string | null;
  userAgent?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const config = await getLoginSecurityConfig();
  if (!config.enabled) return { ok: true };

  const client = String(input.client || "unknown").toLowerCase() as StaffLoginClient;
  // Website / customer login must never hit these checks (different domain + purpose).
  if (client !== "staff" && client !== "pos") {
    return { ok: true };
  }

  const hostRole = classifyHost(input.request.headers.get("host"));
  // If this request is clearly on the public storefront host, skip (ops/POS only).
  if (hostRole === "storefront") {
    return { ok: true };
  }

  const ip = clientIpFromRequest(input.request);

  if (config.requireIp) {
    if (!config.allowedIps.length) {
      return {
        ok: false,
        error: "Login IP allowlist is enabled but empty. Add store IPs in Settings, or turn IP check off.",
        code: "ip_not_configured"
      };
    }
    if (!isIpAllowed(config.allowedIps, ip)) {
      return {
        ok: false,
        error: `Login blocked: this IP (${ip || "unknown"}) is not on the store allowlist.`,
        code: "ip_blocked"
      };
    }
  }

  if (config.requireGeo) {
    if (config.storeLat == null || config.storeLng == null) {
      return {
        ok: false,
        error: "Geo check is enabled but store location is not set. Set it in Settings, or turn geo off.",
        code: "geo_not_configured"
      };
    }
    if (!isWithinStoreGeo(config, input.latitude, input.longitude)) {
      return {
        ok: false,
        error: "Login blocked: you appear to be outside the allowed store area.",
        code: "geo_blocked"
      };
    }
  }

  if (config.requireDevice) {
    const deviceKey = String(input.deviceKey || "").trim();
    if (!deviceKey) {
      return {
        ok: false,
        error: "Login blocked: this browser is not registered. Refresh and try again.",
        code: "device_missing"
      };
    }

    const existing = await queryOne<{
      id: string;
      status: string;
    }>(`select id, status from staff_login_devices where device_key = $1`, [deviceKey]);

    if (!existing) {
      const approvedCount = await queryOne<{ count: string }>(
        `select count(*)::text as count from staff_login_devices where status = 'approved'`
      );
      const autoApprove = Number(approvedCount?.count || 0) === 0;
      await query(
        `insert into staff_login_devices
           (device_key, label, user_agent, last_ip, status, last_seen_at, updated_at)
         values ($1, $2, $3, $4, $5, now(), now())`,
        [
          deviceKey,
          input.deviceLabel || "Store device",
          input.userAgent || null,
          ip || null,
          autoApprove ? "approved" : "pending"
        ]
      );
      if (!autoApprove) {
        return {
          ok: false,
          error: "This device is pending manager approval. Ask a manager to approve it in Settings → Login security.",
          code: "device_pending"
        };
      }
    } else if (existing.status === "blocked") {
      return { ok: false, error: "This device is blocked from staff login.", code: "device_blocked" };
    } else if (existing.status === "pending") {
      return {
        ok: false,
        error: "This device is still pending approval.",
        code: "device_pending"
      };
    } else {
      await query(
        `update staff_login_devices
         set last_ip = $2, user_agent = coalesce($3, user_agent), last_seen_at = now(), updated_at = now()
         where id = $1`,
        [existing.id, ip || null, input.userAgent || null]
      );
    }
  }

  return { ok: true };
}
