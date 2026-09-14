import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, writeAuditLog } from "../../../../lib/auth/api";
import { query } from "../../../../lib/db/pool";
import { ensureProductUnitsSchema } from "../../../../lib/product-units";

export async function GET(request: NextRequest) {
  const { error } = await requireAnyPermission(request, [
    "products:manage",
    "products:read",
    "stock:operate",
    "purchases:operate"
  ]);
  if (error) return error;

  await ensureProductUnitsSchema();
  const { searchParams } = new URL(request.url);
  const unprintedOnly = searchParams.get("unprinted") !== "0";
  const q = String(searchParams.get("q") || "").trim();
  const productId = String(searchParams.get("product") || "").trim();

  const params: unknown[] = [];
  const where: string[] = [`i.status::text = 'to_sell'`];

  if (unprintedOnly) {
    where.push(`i.label_printed = false`);
  }
  if (productId) {
    params.push(productId);
    where.push(`p.id = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(
      `(p.name ilike $${params.length} or coalesce(p.sku,'') ilike $${params.length} or coalesce(i.barcode,'') ilike $${params.length} or coalesce(i.unit_code,'') ilike $${params.length})`
    );
  }

  const rows = await query<{
    id: string;
    barcode: string;
    unit_code: string;
    seq: number;
    tag: string;
    label_printed: boolean;
    product_id: string;
    product_name: string;
    sku: string | null;
    price: string;
    color: string | null;
    label_size: "accessory" | "dress" | null;
    compare_at_price: string | null;
    category_name: string | null;
    date_added: string;
  }>(
    `select
       i.id,
       i.barcode,
       i.unit_code,
       i.seq,
       i.tag,
       i.label_printed,
       p.id as product_id,
       p.name as product_name,
       p.sku,
       p.price::text as price,
       p.color,
       p.label_size::text as label_size,
       p.compare_at_price::text as compare_at_price,
       c.name as category_name,
       i.date_added::text as date_added
     from product_items i
     join products p on p.id = i.product_id
     left join categories c on c.id = p.category_id
     where ${where.join(" and ")}
     order by i.date_added desc, i.seq asc
     limit 800`,
    params
  );

  const summary = {
    total: rows.length,
    unprinted: rows.filter((row) => !row.label_printed).length,
    products: new Set(rows.map((row) => row.product_id)).size
  };

  return ok({ items: rows, summary });
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requireAnyPermission(request, [
    "products:manage",
    "stock:operate",
    "purchases:operate"
  ]);
  if (error || !ctx) return error;

  await ensureProductUnitsSchema();
  const body = (await request.json().catch(() => null)) as {
    itemIds?: string[];
    label_printed?: boolean;
  } | null;
  const ids = (body?.itemIds || []).filter(Boolean);
  if (!ids.length) return fail("itemIds required");

  await query(
    `update product_items set label_printed = $1 where id = any($2::uuid[])`,
    [body?.label_printed !== false, ids]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "barcode_print_mark",
    entityType: "product_items",
    after: { itemIds: ids, label_printed: body?.label_printed !== false }
  });

  return ok({ updated: ids.length });
}
