import { Pool, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __vasrithaPgPool: Pool | undefined;
}

/**
 * Supabase pooler port 5432 = session mode (tiny client cap; breaks on Vercel).
 * Port 6543 = transaction mode (correct for serverless). Rewrite when needed.
 */
export function normalizeDatabaseUrl(raw: string) {
  const url = String(raw || "").trim();
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const isSupabasePooler = /\.pooler\.supabase\.com$/i.test(parsed.hostname);
    const isSessionPort = !parsed.port || parsed.port === "5432";
    if (isSupabasePooler && isSessionPort) {
      parsed.port = "6543";
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function getDatabaseUrl() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (url) return normalizeDatabaseUrl(url);
  // Never fall back to localhost on hosted builds (Vercel / Netlify / etc.)
  const hosted = Boolean(
    process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NODE_ENV === "production"
  );
  if (hosted) {
    const declared = Object.prototype.hasOwnProperty.call(process.env, "DATABASE_URL");
    throw new Error(
      declared
        ? "DATABASE_URL is set but empty on this deployment. Paste your Supabase Postgres URI in the host’s Environment Variables, then Redeploy."
        : "DATABASE_URL is required on hosted environments (set Supabase Postgres URI in Netlify/Vercel env)."
    );
  }
  return "postgresql://postgres:postgres@127.0.0.1:5433/vasritha";
}

function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

export function getPool() {
  if (!global.__vasrithaPgPool) {
    const connectionString = getDatabaseUrl();
    const needsSsl =
      /supabase\.co|sslmode=require/i.test(connectionString) ||
      process.env.PGSSLMODE === "require";
    // Transaction-mode pooler (6543) supports modest concurrency; max:1 serializes
    // every Promise.all and makes admin/dashboard feel slow.
    const max = isServerlessRuntime() ? 5 : 20;
    global.__vasrithaPgPool = new Pool({
      connectionString,
      max,
      idleTimeoutMillis: isServerlessRuntime() ? 60_000 : 30_000,
      connectionTimeoutMillis: 8_000,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined
    });
  }
  return global.__vasrithaPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(text: string, params: unknown[] = []) {
  const result = await getPool().query(text, params);
  return result.rowCount ?? 0;
}

export function isLocalDbConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.USE_LOCAL_POSTGRES === "true");
}

export async function withTransaction<T>(fn: (client: {
  query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>;
  queryOne: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R | null>;
}) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const helper = {
      async query<R extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
        const result = await client.query<R>(text, params);
        return result.rows;
      },
      async queryOne<R extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
        const rows = await helper.query<R>(text, params);
        return rows[0] ?? null;
      }
    };
    const result = await fn(helper);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
