import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, writeAuditLog } from "../../../../../lib/auth/api";
import {
  createFinanceEntry,
  ensureFinanceSchema,
  listFinanceEntries,
  type FinanceCategory,
  type FinanceDirection,
  type FinanceMethod,
  type FinanceStatus
} from "../../../../../lib/finance";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "finance:read",
    "reports:finance",
    "dashboard:finance",
    "finance:write"
  ]);
  if (error) return error;

  await ensureFinanceSchema();
  const { searchParams } = new URL(request.url);
  const data = await listFinanceEntries({
    direction: (searchParams.get("direction") as FinanceDirection | "all") || "all",
    status: (searchParams.get("status") as FinanceStatus | "all") || "all",
    category: searchParams.get("category") || undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    q: searchParams.get("q") || undefined,
    limit: Number(searchParams.get("limit") || 150)
  });
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requireAnyPermission(request, [
    "finance:write",
    "reports:finance",
    "dashboard:finance"
  ]);
  if (error || !ctx) return error;

  await ensureFinanceSchema();
  const body = (await request.json().catch(() => null)) as {
    direction?: FinanceDirection;
    category?: FinanceCategory;
    amount?: number;
    payment_method?: FinanceMethod;
    status?: FinanceStatus;
    entry_date?: string;
    counterparty_name?: string;
    reference_no?: string;
    notes?: string;
  } | null;

  if (!body?.direction || !body?.category || body.amount == null) {
    return fail("direction, category and amount are required");
  }

  try {
    const row = await createFinanceEntry({
      direction: body.direction,
      category: body.category,
      amount: Number(body.amount),
      payment_method: body.payment_method,
      status: body.status,
      entry_date: body.entry_date,
      counterparty_name: body.counterparty_name,
      reference_no: body.reference_no,
      notes: body.notes,
      created_by: ctx.userId
    });
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "create",
      entityType: "finance_payment_entries",
      entityId: row.id,
      after: row
    });
    return ok(row, 201);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to create entry", 400);
  }
}
