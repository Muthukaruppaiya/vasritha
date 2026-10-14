import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission } from "../../../../../lib/auth/api";
import { ensureFinanceSchema, buildProfitAndLoss } from "../../../../../lib/finance";
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
import {
  attachmentHeaders,
  rowsToCsv,
  rowsToPdfBuffer,
  rowsToXlsxBuffer,
  type ExportColumn
} from "../../../../../lib/export-table";

export const runtime = "nodejs";

async function loadFinanceReport(type: string, from?: string, to?: string) {
  switch (type) {
    case "sales":
    case "daily_sales":
    case "monthly_sales":
      return buildSalesFinanceReport({ from, to });
    case "purchases":
      return buildPurchaseFinanceReport({ from, to });
    case "expenses":
      return buildExpenseReport({ from, to });
    case "pnl":
      return buildProfitAndLoss({ from, to });
    case "receivables":
      return { rows: await listReceivables({ from, to }) };
    case "payables":
      return { rows: await listPayables({ from, to }) };
    case "payments":
      return buildPaymentReport({ from, to });
    case "cashflow":
      return buildCashFlow({ from, to });
    case "payment_methods":
      return buildSalesByPaymentMethod({ from, to });
    case "products":
      return buildSalesByProduct({ from, to });
    case "returns":
      return buildReturnsRefundReport({ from, to });
    case "tax":
      return buildTaxSummary({ from, to });
    default:
      throw new Error(
        "Unknown report. Use sales|purchases|expenses|pnl|receivables|payables|payments|cashflow|payment_methods|products|returns|tax"
      );
  }
}

function flattenForExport(payload: Record<string, unknown>): {
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
} {
  const tableRows = (payload.rows as Array<Record<string, unknown>> | undefined) || [];
  if (tableRows.length) {
    const keys = Object.keys(tableRows[0] || {});
    return {
      columns: keys.map((key) => ({ key, label: key.replace(/_/g, " ") })),
      rows: tableRows
    };
  }

  // Snapshot-style reports → one row of summary fields
  const skip = new Set(["rows", "by_category", "inflows", "outflows", "note"]);
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (skip.has(key)) continue;
    if (value != null && typeof value !== "object") summary[key] = value;
  }
  if (Array.isArray(payload.by_category)) {
    return {
      columns: [
        { key: "category", label: "Category" },
        { key: "amount", label: "Amount", format: "money" }
      ],
      rows: (payload.by_category as Array<Record<string, unknown>>).map((r) => ({
        category: r.category,
        amount: r.amount
      }))
    };
  }
  const keys = Object.keys(summary);
  return {
    columns: keys.map((key) => ({
      key,
      label: key.replace(/_/g, " "),
      format: typeof summary[key] === "number" ? "money" : "text"
    })),
    rows: keys.length ? [summary] : []
  };
}

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
  const format = (searchParams.get("format") || "").toLowerCase();

  try {
    const payload = (await loadFinanceReport(type, from, to)) as Record<string, unknown>;

    if (format === "csv" || format === "xlsx" || format === "excel" || format === "pdf") {
      const { columns, rows } = flattenForExport(payload);
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        return new Response(rowsToCsv(columns, rows), {
          headers: attachmentHeaders(
            `finance-${type}-${stamp}.csv`,
            "text/csv; charset=utf-8"
          )
        });
      }
      if (format === "pdf") {
        const pdf = rowsToPdfBuffer(columns, rows, {
          title: `Finance · ${type}`,
          subtitle: [from && `From ${from}`, to && `To ${to}`].filter(Boolean).join(" · ") || undefined
        });
        return new Response(new Uint8Array(pdf), {
          headers: attachmentHeaders(`finance-${type}-${stamp}.pdf`, "application/pdf")
        });
      }
      const xlsx = await rowsToXlsxBuffer(columns, rows, { sheetName: type.slice(0, 28) });
      return new Response(new Uint8Array(xlsx), {
        headers: attachmentHeaders(
          `finance-${type}-${stamp}.xlsx`,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      });
    }

    return ok(payload);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Unknown report", 400);
  }
}
