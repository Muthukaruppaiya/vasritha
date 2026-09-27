/**
 * Runtime DDL (ALTER/CREATE) is expensive on every local request.
 * After `npm run db:optimize`, schema is already applied — skip ensures.
 *
 * Set SKIP_RUNTIME_SCHEMA_ENSURE=false only while inventing new columns
 * before you add them to optimize_v*.sql.
 */
export function skipRuntimeSchemaEnsure() {
  if (process.env.SKIP_RUNTIME_SCHEMA_ENSURE === "true") return true;
  if (process.env.SKIP_RUNTIME_SCHEMA_ENSURE === "false") return false;
  // Hosted: DB is migrated separately; never pay DDL per request.
  return Boolean(
    (process.env.VERCEL || process.env.NETLIFY) && process.env.DATABASE_URL
  );
}
