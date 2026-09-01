/** Skip heavy DDL on every serverless request when hosted DB is already migrated. */
export function skipRuntimeSchemaEnsure() {
  if (process.env.SKIP_RUNTIME_SCHEMA_ENSURE === "true") return true;
  if (process.env.SKIP_RUNTIME_SCHEMA_ENSURE === "false") return false;
  return Boolean(process.env.VERCEL && process.env.DATABASE_URL);
}
