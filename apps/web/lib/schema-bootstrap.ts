import { queryOne } from "./db/pool";

/**
 * Runtime DDL (ALTER/CREATE IF NOT EXISTS) keeps hosted DBs in sync when
 * migrations lag the app. Cached per process after the first success.
 *
 * - SKIP_RUNTIME_SCHEMA_ENSURE=true  → skip only when the relation already exists
 * - SKIP_RUNTIME_SCHEMA_ENSURE=false → always run
 * - unset + production/Vercel        → skip only when relation exists
 * - unset + development              → always run (convenient for local iteration)
 *
 * If skip is on but a required table is missing (optimize never finished),
 * ensure* helpers still create it so admin pages don't 500 with 42P01.
 */
export function skipRuntimeSchemaEnsure() {
  const flag = process.env.SKIP_RUNTIME_SCHEMA_ENSURE;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

const relationExistsCache = new Map<string, boolean>();

/** True when skip is enabled AND the relation is already present. */
export async function skipEnsureIfRelationExists(relation: string) {
  if (!skipRuntimeSchemaEnsure()) return false;
  const name = relation.includes(".") ? relation : `public.${relation}`;
  if (relationExistsCache.get(name) === true) return true;

  const row = await queryOne<{ exists: boolean }>(
    `select to_regclass($1) is not null as exists`,
    [name]
  );
  const exists = Boolean(row?.exists);
  if (exists) relationExistsCache.set(name, true);
  return exists;
}
