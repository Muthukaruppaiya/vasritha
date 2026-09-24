import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import {
  getLoyaltyPopupSettings,
  updateLoyaltyPopupSettings,
  type LoyaltyPopupSettings
} from "../../../../../lib/loyalty-popup";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "settings:business");
  if (error) return error;
  const data = await getLoyaltyPopupSettings();
  return ok(data);
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as Partial<LoyaltyPopupSettings> | null;
  if (!body) return fail("Invalid body");

  const patch: Partial<LoyaltyPopupSettings> = {};
  if ("enabled" in body) patch.enabled = Boolean(body.enabled);
  if ("title" in body) patch.title = String(body.title || "").trim() || "Vasritha Loyalty";
  if ("message" in body) {
    patch.message =
      String(body.message || "").trim() ||
      "Join our loyalty program and get exclusive offers!";
  }
  if ("image_path" in body) {
    const path = body.image_path == null ? null : String(body.image_path).trim();
    patch.image_path = path || null;
  }
  if ("guest_cta_label" in body) {
    patch.guest_cta_label = String(body.guest_cta_label || "").trim() || "Join Now";
  }
  if ("guest_cta_href" in body) {
    patch.guest_cta_href = String(body.guest_cta_href || "").trim() || "/account/register";
  }
  if ("login_cta_label" in body) {
    patch.login_cta_label = String(body.login_cta_label || "").trim() || "Login";
  }
  if ("member_cta_label" in body) {
    patch.member_cta_label = String(body.member_cta_label || "").trim() || "View my account";
  }
  if ("member_cta_href" in body) {
    patch.member_cta_href = String(body.member_cta_href || "").trim() || "/account";
  }
  if ("delay_ms" in body) {
    patch.delay_ms = Math.max(0, Math.min(60000, Number(body.delay_ms) || 0));
  }
  if ("show_once_per_session" in body) {
    patch.show_once_per_session = Boolean(body.show_once_per_session);
  }
  if ("homepage_only" in body) {
    patch.homepage_only = Boolean(body.homepage_only);
  }

  try {
    const data = await updateLoyaltyPopupSettings(patch);
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "update",
      entityType: "loyalty_popup",
      entityId: "site_settings",
      after: data
    });
    return ok(data);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save popup settings", 400);
  }
}
