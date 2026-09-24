import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { queryOne } from "../../../../lib/db/pool";
import { ensureGstSchema } from "../../../../lib/gst";
import { ensureLoginSecuritySchema } from "../../../../lib/login-security";

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
  "default_shipping_fee",
  "delivery_enabled",
  "estimated_delivery_text",
  "order_processing_text",
  "shipping_policy_notes",
  "delivery_pincode_mode",
  "delivery_pincodes",
  "category_shipping_combine_mode",
  "no_refund_policy",
  "exchange_enabled",
  "exchange_window_days",
  "exchange_charge",
  "exchange_condition_text",
  "exchange_non_eligible_text",
  "exchange_process_text",
  "exchange_policy_notes",
  "in_store_exchange_refund_only",
  "in_store_policy_text",
  "social_links",
  "seo_title",
  "seo_description",
  "company_legal_name",
  "company_address",
  "company_gstin",
  "company_state",
  "company_state_code",
  "prices_inclusive_of_gst",
  "staff_login_security_enabled",
  "staff_login_require_ip",
  "staff_login_require_device",
  "staff_login_require_geo",
  "staff_login_allowed_ips",
  "staff_login_store_lat",
  "staff_login_store_lng",
  "staff_login_store_radius_m"
] as const;

export async function GET() {
  await ensureGstSchema();
  await ensureLoginSecuritySchema();
  const { ensureShippingSchema } = await import("../../../../lib/shipping");
  await ensureShippingSchema();
  const { ensureExchangePolicySchema } = await import("../../../../lib/exchange-policy");
  await ensureExchangePolicySchema();
  const data = await queryOne(`select * from site_settings limit 1`);
  return ok(data);
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  await ensureGstSchema();
  await ensureLoginSecuritySchema();
  const { ensureShippingSchema } = await import("../../../../lib/shipping");
  await ensureShippingSchema();
  const { ensureExchangePolicySchema } = await import("../../../../lib/exchange-policy");
  await ensureExchangePolicySchema();

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
