/**
 * Runtime DDL (ALTER/CREATE IF NOT EXISTS) keeps hosted DBs in sync when
 * migrations lag the app. Cached per process after the first success.
 *
 * Set SKIP_RUNTIME_SCHEMA_ENSURE=true locally after `npm run db:optimize`
 * to avoid ALTER on every request. Never leave production skipping unless
 * the Supabase schema is known to match optimize_v*.sql.
 */
export function skipRuntimeSchemaEnsure() {
  return process.env.SKIP_RUNTIME_SCHEMA_ENSURE === "true";
}
