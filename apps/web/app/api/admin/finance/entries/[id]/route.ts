import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, writeAuditLog } from "../../../../../../lib/auth/api";
import {
  ensureFinanceSchema,
  updateFinanceEntry,
  type FinanceCategory,
  type FinanceMethod,
  type FinanceStatus
} from "../../../../../../lib/finance";
import { query, queryOne } from "../../../../../../lib/db/pool";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requireAnyPermission(request, [
    "finance:write",
    "reports:finance",
    "dashboard:finance"
  ]);
  if (error || !ctx) return error;

  await ensureFinanceSchema();
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    category?: FinanceCategory;
    amount?: number;
    payment_method?: FinanceMethod;
    status?: FinanceStatus;
    entry_date?: string;
    counterparty_name?: string | null;
    reference_no?: string | null;
    notes?: string | null;
  } | null;
  if (!body) return fail("Invalid body");

  try {
    const before = await queryOne(`select * from finance_payment_entries where id = $1`, [id]);
    if (!before) return fail("Entry not found", 404);
    const row = await updateFinanceEntry(id, body);
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "update",
      entityType: "finance_payment_entries",
      entityId: id,
      before,
      after: row
    });
    return ok(row);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to update entry", 400);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requireAnyPermission(request, [
    "finance:write",
    "reports:finance",
    "dashboard:finance"
  ]);
  if (error || !ctx) return error;

  await ensureFinanceSchema();
  const { id } = await params;
  const before = await queryOne(`select * from finance_payment_entries where id = $1`, [id]);
  if (!before) return fail("Entry not found", 404);

  // Soft-cancel keeps audit trail; hard delete only for non-synced manual rows without payment_id
  if ((before as { payment_id?: string | null }).payment_id) {
    const row = await updateFinanceEntry(id, { status: "cancelled" });
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "cancel",
      entityType: "finance_payment_entries",
      entityId: id,
      before,
      after: row
    });
    return ok(row);
  }

  await query(`delete from finance_payment_entries where id = $1`, [id]);
  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "delete",
    entityType: "finance_payment_entries",
    entityId: id,
    before
  });
  return ok({ id, deleted: true });
}
