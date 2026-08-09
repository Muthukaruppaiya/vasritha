import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { queryOne } from "../../../../lib/db/pool";

const ALLOWED_FIELDS = [
  "site_name",
  "tagline",
  "logo_path",
  "header_logo_path",
  "favicon_path",
  "support_email",
  "support_phone",
  "whatsapp_number",
  "currency",
  "free_shipping_min",
  "social_links",
  "seo_title",
  "seo_description",
  "company_legal_name",
  "company_address",
  "company_gstin"
] as const;

export async function GET() {
  const data = await queryOne(`select * from site_settings limit 1`);
  return ok(data);
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Invalid body");

  const existing = await queryOne<{ id: string }>(`select id from site_settings limit 1`);
  if (!existing) return fail("Settings row missing", 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  for (const key of ALLOWED_FIELDS) {
    if (key in body) {
      values.push(key === "social_links" ? JSON.stringify(body[key]) : body[key]);
      updates.push(key === "social_links" ? `${key} = $${values.length}::jsonb` : `${key} = $${values.length}`);
    }
  }
  updates.push("updated_at = now()");

  values.push(existing.id);
  const data = await queryOne(
    `update site_settings set ${updates.join(", ")} where id = $${values.length} returning *`,
    values
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "site_settings",
    entityId: existing.id,
    after: data
  });
  return ok(data);
}
