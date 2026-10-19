import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission } from "../../../../lib/auth/api";
import { REPORT_CATALOG, runReport } from "../../../../lib/reports";
import {
  attachmentHeaders,
  rowsToCsv,
  rowsToPdfBuffer,
  rowsToXlsxBuffer
} from "../../../../lib/export-table";

export const runtime = "nodejs";

function filtersFrom(searchParams: URLSearchParams) {
  return {
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    q: searchParams.get("q") || undefined,
    customer: searchParams.get("customer") || undefined,
    product: searchParams.get("product") || undefined,
    category: searchParams.get("category") || undefined,
    payment_method: searchParams.get("payment_method") || undefined,
    order_status: searchParams.get("order_status") || undefined,
    payment_status: searchParams.get("payment_status") || undefined,
    stock_status: (searchParams.get("stock_status") as "all" | "low" | "out" | "in") || "all"
  };
}

async function loadFullReport(type: string, searchParams: URLSearchParams) {
  const base = filtersFrom(searchParams);
  const probe = await runReport(type, { ...base, page: 1, pageSize: 200 });
  if (probe.pagination.total <= probe.rows.length) return probe;
  return runReport(type, {
    ...base,
    page: 1,
    pageSize: Math.min(Math.max(probe.pagination.total, 1), 2000)
  });
}

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

  const format = (searchParams.get("format") || "").toLowerCase();

  try {
    if (format === "csv" || format === "xlsx" || format === "excel" || format === "pdf") {
      const all = await loadFullReport(type, searchParams);
      const stamp = new Date().toISOString().slice(0, 10);
      const subtitle = [all.from && `From ${all.from}`, all.to && `To ${all.to}`]
        .filter(Boolean)
        .join(" · ");

      if (format === "csv") {
        const csv = rowsToCsv(all.columns, all.rows);
        return new Response(csv, {
          status: 200,
          headers: attachmentHeaders(`${type}-report-${stamp}.csv`, "text/csv; charset=utf-8")
        });
      }

      if (format === "pdf") {
        const pdf = rowsToPdfBuffer(all.columns, all.rows, {
          title: all.title || `${type} report`,
          subtitle: subtitle || undefined
        });
        return new Response(new Uint8Array(pdf), {
          status: 200,
          headers: attachmentHeaders(`${type}-report-${stamp}.pdf`, "application/pdf")
        });
      }

      const xlsx = await rowsToXlsxBuffer(all.columns, all.rows, {
        sheetName: type.slice(0, 28) || "Report",
        title: all.title
      });
      return new Response(new Uint8Array(xlsx), {
        status: 200,
        headers: attachmentHeaders(
          `${type}-report-${stamp}.xlsx`,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      });
    }

    const result = await runReport(type, {
      ...filtersFrom(searchParams),
      page: Number(searchParams.get("page") || 1),
      pageSize: Number(searchParams.get("pageSize") || 10)
    });
    return ok(result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to run report", 400);
  }
}
