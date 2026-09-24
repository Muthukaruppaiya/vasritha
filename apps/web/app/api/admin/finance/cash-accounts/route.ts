import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, writeAuditLog } from "../../../../../lib/auth/api";
import { ensureFinanceSchema } from "../../../../../lib/finance";
import { createCashAccount, listCashAccounts } from "../../../../../lib/finance-accounts";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "finance:read",
    "reports:finance",
    "finance:write"
  ]);
  if (error) return error;
  await ensureFinanceSchema();
  return ok(await listCashAccounts(true));
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requireAnyPermission(request, ["finance:write"]);
  if (error || !ctx) return error;
  await ensureFinanceSchema();
  const body = (await request.json().catch(() => null)) as {
    code?: string;
    name?: string;
    kind?: "cash" | "bank";
    opening_balance?: number;
    notes?: string;
  } | null;
  try {
    const row = await createCashAccount({
      code: body?.code || "",
      name: body?.name || "",
      kind: body?.kind || "cash",
      opening_balance: body?.opening_balance,
      notes: body?.notes
    });
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "create",
      entityType: "finance_cash_accounts",
      entityId: row.id,
      after: row
    });
    return ok(row, 201);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to create cash account", 400);
  }
}
