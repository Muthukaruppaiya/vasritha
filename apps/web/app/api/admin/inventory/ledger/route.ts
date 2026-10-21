import { NextRequest } from "next/server";
import { ok, requireAnyPermission } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";
import { resolveShopScope } from "../../../../../lib/shop-scope";

/**
 * Older POS / online sale rows were stored with a positive quantity, so the
 * direction is taken from the movement type, not the stored sign.
 */
const SIGNED_QTY_SQL = `
  case
    when m.type in ('sale', 'transfer_out') then -abs(m.quantity)
    when m.type in ('purchase', 'return', 'opening_stock', 'transfer_in') then abs(m.quantity)
    else m.quantity
  end
`;

const MOVEMENT_TYPES = new Set([
  "sale",
  "purchase",
  "return",
  "manual_adjustment",
  "opening_stock",
  "transfer_in",
  "transfer_out"
]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Stock ledger: every stock movement with direction and document reference. */
export async function GET(request: NextRequest) {
  const { error, ctx } = await requireAnyPermission(request, [
    "stock:operate",
    "stock:approve",
    "purchases:operate"
  ]);
  if (error || !ctx) return error;

  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get("q") || "").trim();
  const productId = String(searchParams.get("product") || "").trim();
  const variantId = String(searchParams.get("variant") || "").trim();
  const type = String(searchParams.get("type") || "").trim();
  const from = String(searchParams.get("from") || "").trim();
  const to = String(searchParams.get("to") || "").trim();
  const preferredShop = searchParams.get("shopId")?.trim() || null;
  const limitRaw = Number(searchParams.get("limit") || "25");
  const offsetRaw = Number(searchParams.get("offset") || "0");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : 25;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;

  const scope = await resolveShopScope(ctx, preferredShop);
  const shopId = scope.mode === "one" ? scope.shopId : preferredShop || null;

  const params: unknown[] = [];
  const where: string[] = [];

  if (shopId && isUuid(shopId)) {
    params.push(shopId);
    // Online orders / legacy rows carry no shop; keep them visible.
    where.push(`(m.shop_id = $${params.length} or m.shop_id is null)`);
  }
  if (productId && isUuid(productId)) {
    params.push(productId);
    where.push(`p.id = $${params.length}`);
  }
  if (variantId && isUuid(variantId)) {
    params.push(variantId);
    where.push(`pv.id = $${params.length}`);
  }
  if (type === "in") where.push(`(${SIGNED_QTY_SQL}) > 0`);
  else if (type === "out") where.push(`(${SIGNED_QTY_SQL}) < 0`);
  else if (MOVEMENT_TYPES.has(type)) {
    params.push(type);
    where.push(`m.type = $${params.length}`);
  }
  if (isIsoDate(from)) {
    params.push(from);
    where.push(
      `m.created_at >= ($${params.length}::date)::timestamp at time zone 'Asia/Kolkata'`
    );
  }
  if (isIsoDate(to)) {
    params.push(to);
    where.push(
      `m.created_at < ($${params.length}::date + 1)::timestamp at time zone 'Asia/Kolkata'`
    );
  }
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    where.push(`(
      p.name ilike ${p}
      or coalesce(pv.sku, '') ilike ${p}
      or coalesce(pv.barcode, '') ilike ${p}
      or coalesce(o.order_number, '') ilike ${p}
      or ('INV-' || coalesce(o.order_number, '')) ilike ${p}
      or coalesce(g.grn_number, '') ilike ${p}
      or coalesce(g.bill_no, '') ilike ${p}
      or coalesce(r.return_number, '') ilike ${p}
      or coalesce(m.note, '') ilike ${p}
    )`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const fromSql = `
    from inventory_movements m
    join product_variants pv on pv.id = m.product_variant_id
    join products p on p.id = pv.product_id
    left join orders o on m.reference_type = 'order' and o.id = m.reference_id
    left join inventory_grns g on m.reference_type = 'grn' and g.id = m.reference_id
    left join suppliers sup on sup.id = g.supplier_id
    left join order_returns r on m.reference_type = 'exchange' and r.id = m.reference_id
    left join users u on u.id = m.created_by
    left join shops sh on sh.id = m.shop_id
  `;

  const [rows, totals] = await Promise.all([
    query<{
      id: string;
      created_at: string;
      type: string;
      quantity: number;
      signed_qty: number;
      note: string | null;
      reference_type: string | null;
      reference_id: string | null;
      order_number: string | null;
      order_channel: string | null;
      grn_number: string | null;
      bill_no: string | null;
      supplier_name: string | null;
      return_number: string | null;
      variant_id: string;
      sku: string | null;
      variant_name: string | null;
      product_id: string;
      product_name: string;
      product_color: string | null;
      shop_name: string | null;
      created_by_name: string | null;
    }>(
      `select
         m.id,
         m.created_at,
         m.type::text as type,
         m.quantity,
         (${SIGNED_QTY_SQL})::int as signed_qty,
         m.note,
         m.reference_type,
         m.reference_id,
         o.order_number,
         coalesce(o.channel, case when o.id is not null then 'online' end) as order_channel,
         g.grn_number,
         g.bill_no,
         sup.name as supplier_name,
         r.return_number,
         pv.id as variant_id,
         pv.sku,
         pv.name as variant_name,
         p.id as product_id,
         p.name as product_name,
         p.color as product_color,
         sh.name as shop_name,
         coalesce(nullif(u.full_name, ''), u.email) as created_by_name
       ${fromSql}
       ${whereSql}
       order by m.created_at desc, m.id desc
       limit ${limit} offset ${offset}`,
      params
    ),
    queryOne<{ total: number; qty_in: number; qty_out: number }>(
      `select
         count(*)::int as total,
         coalesce(sum(greatest((${SIGNED_QTY_SQL}), 0)), 0)::int as qty_in,
         coalesce(sum(least((${SIGNED_QTY_SQL}), 0)), 0)::int as qty_out
       ${fromSql}
       ${whereSql}`,
      params
    )
  ]);

  type LedgerProduct = {
    id: string;
    name: string;
    sku: string | null;
    color: string | null;
    on_hand: number;
  };
  let product: LedgerProduct | null = null;
  if (productId && isUuid(productId)) {
    product = await queryOne<LedgerProduct>(
      `select p.id, p.name, p.sku, p.color,
              coalesce((
                select sum(s.stock_quantity)::int
                from shop_variant_stock s
                join product_variants v on v.id = s.variant_id
                where v.product_id = p.id
                  and ($2::uuid is null or s.shop_id = $2::uuid)
              ), 0) as on_hand
       from products p
       where p.id = $1`,
      [productId, shopId && isUuid(shopId) ? shopId : null]
    );
  }

  return ok({
    rows,
    total: Number(totals?.total || 0),
    totals: {
      in: Number(totals?.qty_in || 0),
      out: Math.abs(Number(totals?.qty_out || 0)),
      net: Number(totals?.qty_in || 0) + Number(totals?.qty_out || 0)
    },
    product,
    shopId,
    shopName: scope.mode === "one" ? scope.shopName : null,
    limit,
    offset
  });
}
