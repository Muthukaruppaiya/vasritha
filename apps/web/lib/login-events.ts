import { query, queryOne } from "./db/pool";
import { skipRuntimeSchemaEnsure } from "./schema-bootstrap";
import { clientIpFromRequest } from "./login-security";

export type LoginClient = "staff" | "pos" | "website" | "unknown";

export type LoginEvent = {
  id: string;
  user_id: string | null;
  email_attempted: string;
  success: boolean;
  failure_code: string | null;
  failure_message: string | null;
  client: LoginClient | string;
  ip: string | null;
  user_agent: string | null;
  device_key: string | null;
  device_label: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  roles_snapshot: string[] | null;
  created_at: string;
  full_name?: string | null;
  user_email?: string | null;
  user_phone?: string | null;
};

let schemaReady = false;

export async function ensureLoginEventsSchema() {
  if (schemaReady || skipRuntimeSchemaEnsure()) return;
  await query(`
    create table if not exists public.login_events (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references public.users(id) on delete set null,
      email_attempted text not null,
      success boolean not null default false,
      failure_code text,
      failure_message text,
      client text not null default 'website',
      ip text,
      user_agent text,
      device_key text,
      device_label text,
      latitude numeric(10,7),
      longitude numeric(10,7),
      roles_snapshot jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await query(`
    create index if not exists login_events_created_idx
      on public.login_events (created_at desc)
  `);
  await query(`
    create index if not exists login_events_user_idx
      on public.login_events (user_id, created_at desc)
      where user_id is not null
  `);
  await query(`
    create index if not exists login_events_client_success_idx
      on public.login_events (client, success, created_at desc)
  `);
  schemaReady = true;
}

function normalizeClient(raw?: string | null): LoginClient {
  const value = String(raw || "website").toLowerCase();
  if (value === "staff" || value === "pos" || value === "website") return value;
  return "unknown";
}

export async function recordLoginEvent(input: {
  request: Request;
  email: string;
  userId?: string | null;
  success: boolean;
  failureCode?: string | null;
  failureMessage?: string | null;
  client?: string | null;
  deviceKey?: string | null;
  deviceLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  roles?: string[] | null;
}) {
  try {
    await ensureLoginEventsSchema();
    const row = await queryOne<LoginEvent>(
      `insert into login_events (
         user_id, email_attempted, success, failure_code, failure_message, client,
         ip, user_agent, device_key, device_label, latitude, longitude, roles_snapshot
       ) values (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12, $13::jsonb
       )
       returning *`,
      [
        input.userId || null,
        String(input.email || "").trim().toLowerCase() || "unknown",
        Boolean(input.success),
        input.failureCode || null,
        input.failureMessage || null,
        normalizeClient(input.client),
        clientIpFromRequest(input.request) || null,
        input.request.headers.get("user-agent") || null,
        input.deviceKey || null,
        input.deviceLabel || null,
        input.latitude ?? null,
        input.longitude ?? null,
        input.roles?.length ? JSON.stringify(input.roles) : null
      ]
    );
    return row;
  } catch {
    // Never block authentication because of logging.
    return null;
  }
}

export type ListLoginEventFilters = {
  q?: string;
  client?: string;
  success?: "all" | "yes" | "no";
  from?: string;
  to?: string;
  limit?: number;
};

export async function listLoginEvents(filters: ListLoginEventFilters = {}) {
  await ensureLoginEventsSchema();
  const limit = Math.min(300, Math.max(1, filters.limit || 100));
  const params: unknown[] = [];
  const where: string[] = ["1=1"];

  if (filters.client && filters.client !== "all") {
    params.push(filters.client);
    where.push(`e.client = $${params.length}`);
  }
  if (filters.success === "yes") where.push("e.success = true");
  if (filters.success === "no") where.push("e.success = false");
  if (filters.from) {
    params.push(filters.from);
    where.push(`e.created_at >= $${params.length}::date`);
  }
  if (filters.to) {
    params.push(filters.to);
    where.push(`e.created_at < ($${params.length}::date + interval '1 day')`);
  }
  if (filters.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    where.push(
      `(e.email_attempted ilike $${params.length} or u.full_name ilike $${params.length} or u.email ilike $${params.length} or e.ip ilike $${params.length} or e.device_label ilike $${params.length})`
    );
  }
  params.push(limit);

  return query<LoginEvent>(
    `select e.*, u.full_name, u.email as user_email, u.phone as user_phone
     from login_events e
     left join users u on u.id = e.user_id
     where ${where.join(" and ")}
     order by e.created_at desc
     limit $${params.length}`,
    params
  );
}

export async function getLoginEvent(id: string) {
  await ensureLoginEventsSchema();
  return queryOne<LoginEvent>(
    `select e.*, u.full_name, u.email as user_email, u.phone as user_phone
     from login_events e
     left join users u on u.id = e.user_id
     where e.id = $1`,
    [id]
  );
}

export async function loginEventStats() {
  await ensureLoginEventsSchema();
  const row = await queryOne<{
    total_24h: string;
    success_24h: string;
    failed_24h: string;
    staff_24h: string;
  }>(
    `select
       count(*)::text as total_24h,
       count(*) filter (where success)::text as success_24h,
       count(*) filter (where not success)::text as failed_24h,
       count(*) filter (where client in ('staff', 'pos') and success)::text as staff_24h
     from login_events
     where created_at >= now() - interval '24 hours'`
  );
  return {
    total_24h: Number(row?.total_24h || 0),
    success_24h: Number(row?.success_24h || 0),
    failed_24h: Number(row?.failed_24h || 0),
    staff_24h: Number(row?.staff_24h || 0)
  };
}
