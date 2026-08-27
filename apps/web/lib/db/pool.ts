import { Pool, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __vasrithaPgPool: Pool | undefined;
}

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  // Never fall back to localhost on Vercel / hosted builds
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL is required on hosted environments (set Supabase Postgres URI in Vercel env)."
    );
  }
  return "postgresql://postgres:postgres@127.0.0.1:5433/vasritha";
}

export function getPool() {
  if (!global.__vasrithaPgPool) {
    const connectionString = getDatabaseUrl();
    const needsSsl =
      /supabase\.co|sslmode=require/i.test(connectionString) ||
      process.env.PGSSLMODE === "require";
    global.__vasrithaPgPool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
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
