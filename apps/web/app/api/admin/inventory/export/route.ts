import { NextRequest } from "next/server";
import { fail, requirePermission } from "../../../../../lib/auth/api";
import { query } from "../../../../../lib/db/pool";
import { ensureProductUnitsSchema } from "../../../../../lib/product-units";
import { requireScopedShopId } from "../../../../../lib/shop-scope";
import {
  attachmentHeaders,
  rowsToCsv,
  rowsToPdfBuffer,
  rowsToXlsxBuffer,
  type ExportColumn
} from "../../../../../lib/export-table";

export const runtime = "nodejs";

const COLUMNS: ExportColumn[] = [
  { key: "product_name", label: "Product" },
  { key: "sku", label: "SKU" },
  { key: "variant_name", label: "Variant / size" },
  { key: "category_name", label: "Category" },
  { key: "subcategory_name", label: "Subcategory" },
  { key: "product_color", label: "Colour" },
  { key: "hsn_code", label: "HSN" },
  { key: "gst_rate", label: "GST %", format: "number" },
  { key: "stock_quantity", label: "On hand", format: "number" },
  { key: "product_status", label: "Status" }
];

export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "stock:operate");
  if (error || !ctx) return error;

  await ensureProductUnitsSchema();
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "xlsx").toLowerCase();
  const q = (searchParams.get("q") || "").trim();
  const preferredShop = searchParams.get("shopId")?.trim() || null;

  let shopId: string;
  try {
    shopId = (await requireScopedShopId(ctx, preferredShop)).shopId;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No active shop");
  }

  try {
    const rows = await query<Record<string, unknown>>(
      `select
         p.name as product_name,
         pv.sku,
         pv.name as variant_name,
         c.name as category_name,
         sc.name as subcategory_name,
         p.color as product_color,
         p.hsn_code,
         p.gst_rate,
         coalesce(svs.stock_quantity, 0) as stock_quantity,
         p.status::text as product_status
       from product_variants pv
       join products p on p.id = pv.product_id
       left join shop_variant_stock svs
         on svs.variant_id = pv.id and svs.shop_id = $1
       left join categories c on c.id = p.category_id
       left join subcategories sc on sc.id = p.subcategory_id
       where (
         $2::text = ''
         or p.name ilike '%' || $2 || '%'
         or coalesce(pv.sku, '') ilike '%' || $2 || '%'
       )
       order by p.name asc, pv.sku asc
       limit 5000`,
      [shopId, q]
    );

    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      return new Response(rowsToCsv(COLUMNS, rows), {
        headers: attachmentHeaders(`inventory-${stamp}.csv`, "text/csv; charset=utf-8")
      });
    }
    if (format === "pdf") {
      const pdf = rowsToPdfBuffer(COLUMNS, rows, { title: "Inventory export" });
      return new Response(new Uint8Array(pdf), {
        headers: attachmentHeaders(`inventory-${stamp}.pdf`, "application/pdf")
      });
    }
    const xlsx = await rowsToXlsxBuffer(COLUMNS, rows, { sheetName: "Inventory" });
    return new Response(new Uint8Array(xlsx), {
      headers: attachmentHeaders(
        `inventory-${stamp}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Export failed", 500);
  }
}
