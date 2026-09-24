import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, writeAuditLog } from "../../../../../lib/auth/api";
import { ensureFinanceSchema } from "../../../../../lib/finance";
import { getFinanceSettings, updateFinanceSettings } from "../../../../../lib/finance-accounts";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "finance:read",
    "finance:write",
    "reports:finance"
  ]);
  if (error) return error;
  await ensureFinanceSchema();
  return ok(await getFinanceSettings());
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requireAnyPermission(request, ["finance:write"]);
  if (error || !ctx) return error;
  await ensureFinanceSchema();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Invalid body");
  try {
    const before = await getFinanceSettings();
    const row = await updateFinanceSettings({
      fy_start_month: body.fy_start_month != null ? Number(body.fy_start_month) : undefined,
      default_cash_account_id:
        body.default_cash_account_id === undefined
          ? undefined
          : (body.default_cash_account_id as string | null),
      default_bank_account_id:
        body.default_bank_account_id === undefined
          ? undefined
          : (body.default_bank_account_id as string | null),
      default_sales_account_id:
        body.default_sales_account_id === undefined
          ? undefined
          : (body.default_sales_account_id as string | null),
      default_purchase_account_id:
        body.default_purchase_account_id === undefined
          ? undefined
          : (body.default_purchase_account_id as string | null),
      currency: body.currency != null ? String(body.currency) : undefined
    });
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "update",
      entityType: "finance_settings",
      entityId: "1",
      before,
      after: row
    });
    return ok(row);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Update failed", 400);
  }
}
