import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, writeAuditLog } from "../../../../../../lib/auth/api";
import { ensureFinanceSchema } from "../../../../../../lib/finance";
import { updateFinanceAccount } from "../../../../../../lib/finance-accounts";
import { queryOne } from "../../../../../../lib/db/pool";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requireAnyPermission(request, ["finance:write"]);
  if (error || !ctx) return error;
  await ensureFinanceSchema();
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    notes?: string | null;
    is_active?: boolean;
  } | null;
  if (!body) return fail("Invalid body");

  if (body.is_active === false) {
    const used = await queryOne<{ c: string }>(
      `select count(*)::text as c from finance_payment_entries where account_id = $1`,
      [id]
    );
    // Still allow deactivate even if used — never hard-delete
    void used;
  }

  try {
    const before = await queryOne(`select * from finance_accounts where id = $1`, [id]);
    if (!before) return fail("Account not found", 404);
    const row = await updateFinanceAccount(id, body);
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "update",
      entityType: "finance_accounts",
      entityId: id,
      before,
      after: row
    });
    return ok(row);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Update failed", 400);
  }
}
