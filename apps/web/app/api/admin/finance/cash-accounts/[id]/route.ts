import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, writeAuditLog } from "../../../../../../lib/auth/api";
import { ensureFinanceSchema } from "../../../../../../lib/finance";
import { updateCashAccount } from "../../../../../../lib/finance-accounts";
import { queryOne } from "../../../../../../lib/db/pool";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requireAnyPermission(request, ["finance:write"]);
  if (error || !ctx) return error;
  await ensureFinanceSchema();
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    opening_balance?: number;
    is_active?: boolean;
    is_default?: boolean;
    notes?: string | null;
  } | null;
  if (!body) return fail("Invalid body");
  try {
    const before = await queryOne(`select * from finance_cash_accounts where id = $1`, [id]);
    if (!before) return fail("Not found", 404);
    const row = await updateCashAccount(id, body);
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "update",
      entityType: "finance_cash_accounts",
      entityId: id,
      before,
      after: row
    });
    return ok(row);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Update failed", 400);
  }
}
