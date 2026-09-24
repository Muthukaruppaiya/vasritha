import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission } from "../../../../lib/auth/api";
import { REPORT_CATALOG, rowsToCsv, runReport } from "../../../../lib/reports";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "reports:ops",
    "reports:finance",
    "exports:finance",
    "dashboard:ops",
    "dashboard:finance",
    "dashboard:all",
    "finance:read"
  ]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const listOnly = searchParams.get("list") === "1";
  if (listOnly) {
    return ok({ reports: REPORT_CATALOG });
  }

  const type = searchParams.get("type") || "";
  if (!type) {
    return fail("type is required (or use list=1)");
  }

  try {
    const result = await runReport(type, {
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      q: searchParams.get("q") || undefined,
      customer: searchParams.get("customer") || undefined,
      product: searchParams.get("product") || undefined,
      category: searchParams.get("category") || undefined,
      payment_method: searchParams.get("payment_method") || undefined,
      order_status: searchParams.get("order_status") || undefined,
      payment_status: searchParams.get("payment_status") || undefined,
      stock_status: (searchParams.get("stock_status") as "all" | "low" | "out" | "in") || "all",
      page: Number(searchParams.get("page") || 1),
      pageSize: Number(searchParams.get("pageSize") || 50)
    });

    if (searchParams.get("format") === "csv") {
      // Export all matching rows (re-run without pagination slice by requesting large page)
      const full = await runReport(type, {
        from: searchParams.get("from") || undefined,
        to: searchParams.get("to") || undefined,
        q: searchParams.get("q") || undefined,
        customer: searchParams.get("customer") || undefined,
        product: searchParams.get("product") || undefined,
        category: searchParams.get("category") || undefined,
        payment_method: searchParams.get("payment_method") || undefined,
        order_status: searchParams.get("order_status") || undefined,
        payment_status: searchParams.get("payment_status") || undefined,
        stock_status: (searchParams.get("stock_status") as "all" | "low" | "out" | "in") || "all",
        page: 1,
        pageSize: 200
      });
      // For CSV we need all rows — rebuild from summary path: use pagination total
      const all =
        full.pagination.total <= full.rows.length
          ? full
          : await runReport(type, {
              from: searchParams.get("from") || undefined,
              to: searchParams.get("to") || undefined,
              q: searchParams.get("q") || undefined,
              customer: searchParams.get("customer") || undefined,
              product: searchParams.get("product") || undefined,
              category: searchParams.get("category") || undefined,
              payment_method: searchParams.get("payment_method") || undefined,
              order_status: searchParams.get("order_status") || undefined,
              payment_status: searchParams.get("payment_status") || undefined,
              stock_status: (searchParams.get("stock_status") as "all" | "low" | "out" | "in") || "all",
              page: 1,
              pageSize: Math.min(Math.max(full.pagination.total, 1), 2000)
            });
      const csv = rowsToCsv(all.columns, all.rows);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${type}-report.csv"`
        }
      });
    }

    return ok(result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to run report", 400);
  }
}
