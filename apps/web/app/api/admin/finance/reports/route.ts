import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission } from "../../../../../lib/auth/api";
import { ensureFinanceSchema } from "../../../../../lib/finance";
import {
  buildCashFlow,
  buildExpenseReport,
  buildPaymentReport,
  buildPurchaseFinanceReport,
  buildReturnsRefundReport,
  buildSalesByPaymentMethod,
  buildSalesByProduct,
  buildSalesFinanceReport,
  buildTaxSummary,
  listPayables,
  listReceivables
} from "../../../../../lib/finance-reports";
import { buildProfitAndLoss } from "../../../../../lib/finance";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "finance:read",
    "reports:finance",
    "exports:finance",
    "finance:write"
  ]);
  if (error) return error;
  await ensureFinanceSchema();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "sales";
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  switch (type) {
    case "sales":
    case "daily_sales":
    case "monthly_sales":
      return ok(await buildSalesFinanceReport({ from, to }));
    case "purchases":
      return ok(await buildPurchaseFinanceReport({ from, to }));
    case "expenses":
      return ok(await buildExpenseReport({ from, to }));
    case "pnl":
      return ok(await buildProfitAndLoss({ from, to }));
    case "receivables":
      return ok({ rows: await listReceivables({ from, to }) });
    case "payables":
      return ok({ rows: await listPayables({ from, to }) });
    case "payments":
      return ok(await buildPaymentReport({ from, to }));
    case "cashflow":
      return ok(await buildCashFlow({ from, to }));
    case "payment_methods":
      return ok(await buildSalesByPaymentMethod({ from, to }));
    case "products":
      return ok(await buildSalesByProduct({ from, to }));
    case "returns":
      return ok(await buildReturnsRefundReport({ from, to }));
    case "tax":
      return ok(await buildTaxSummary({ from, to }));
    default:
      return fail(
        "Unknown report. Use sales|purchases|expenses|pnl|receivables|payables|payments|cashflow|payment_methods|products|returns|tax"
      );
  }
}
