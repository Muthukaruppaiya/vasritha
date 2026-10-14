import { NextRequest } from "next/server";
import { fail, requirePermission } from "../../../../../lib/auth/api";
import { query } from "../../../../../lib/db/pool";
import {
  attachmentHeaders,
  rowsToCsv,
  rowsToPdfBuffer,
  rowsToXlsxBuffer,
  type ExportColumn
} from "../../../../../lib/export-table";

export const runtime = "nodejs";

const COLUMNS: ExportColumn[] = [
  { key: "name", label: "Name" },
  { key: "short_name", label: "Short name" },
  { key: "sku", label: "SKU" },
  { key: "barcode", label: "Barcode" },
  { key: "tag", label: "Tag" },
  { key: "category_name", label: "Category" },
  { key: "subcategory_name", label: "Subcategory" },
  { key: "color", label: "Colour" },
  { key: "is_multicolour", label: "Multicolour" },
  { key: "price", label: "Price", format: "money" },
  { key: "compare_at_price", label: "Compare at", format: "money" },
  { key: "hsn_code", label: "HSN" },
  { key: "gst_rate", label: "GST %", format: "number" },
  { key: "label_size", label: "Label size" },
  { key: "status", label: "Status" },
  { key: "stock_quantity", label: "Stock", format: "number" },
  { key: "unit_count", label: "Pieces", format: "number" },
  { key: "is_featured", label: "Featured" },
  { key: "restock_expected", label: "Coming soon" },
  { key: "created_at", label: "Created", format: "date" }
];

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "products:read");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "xlsx").toLowerCase();
  const status = searchParams.get("status");
  const q = (searchParams.get("q") || "").trim();

  try {
    const rows = await query<Record<string, unknown>>(
      `select
         p.name, p.short_name, p.sku, p.barcode, p.tag,
         c.name as category_name, sc.name as subcategory_name,
         p.color, case when p.is_multicolour then 'yes' else 'no' end as is_multicolour,
         p.price, p.compare_at_price, p.hsn_code, p.gst_rate, p.label_size::text as label_size,
         p.status::text as status, coalesce(p.stock_quantity, 0) as stock_quantity,
         coalesce((select count(*)::int from product_items pi where pi.product_id = p.id), 0) as unit_count,
         case when p.is_featured then 'yes' else 'no' end as is_featured,
         case when coalesce(p.restock_expected, false) then 'yes' else 'no' end as restock_expected,
         p.created_at
       from products p
       left join categories c on c.id = p.category_id
       left join subcategories sc on sc.id = p.subcategory_id
       where ($1::text is null or p.status::text = $1)
         and (
           $2::text = ''
           or p.name ilike '%' || $2 || '%'
           or coalesce(p.sku, '') ilike '%' || $2 || '%'
           or coalesce(p.barcode, '') ilike '%' || $2 || '%'
         )
       order by p.created_at desc
       limit 5000`,
      [status, q]
    );

    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      return new Response(rowsToCsv(COLUMNS, rows), {
        headers: attachmentHeaders(`products-${stamp}.csv`, "text/csv; charset=utf-8")
      });
    }
    if (format === "pdf") {
      const pdf = rowsToPdfBuffer(COLUMNS, rows, { title: "Product Master export" });
      return new Response(new Uint8Array(pdf), {
        headers: attachmentHeaders(`products-${stamp}.pdf`, "application/pdf")
      });
    }
    const xlsx = await rowsToXlsxBuffer(COLUMNS, rows, { sheetName: "Products" });
    return new Response(new Uint8Array(xlsx), {
      headers: attachmentHeaders(
        `products-${stamp}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Export failed", 500);
  }
}
