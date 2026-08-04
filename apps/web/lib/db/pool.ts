import { Pool, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __vasrithaPgPool: Pool | undefined;
}

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/vasritha";
}

export function getPool() {
  if (!global.__vasrithaPgPool) {
    global.__vasrithaPgPool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 10
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
