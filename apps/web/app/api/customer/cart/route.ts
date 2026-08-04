import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

type Cart = { id: string; customer_id: string; updated_at: string };

async function getOrCreateCart(customerId: string): Promise<Cart | null> {
  const existing = await queryOne<Cart>(`select * from carts where customer_id = $1`, [customerId]);
  if (existing) return existing;

  return queryOne<Cart>(
    `insert into carts (customer_id) values ($1) returning *`,
    [customerId]
  );
}

export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cart:own");
  if (error || !ctx) return error;

  const cart = await getOrCreateCart(ctx.userId);
  if (!cart) return fail("Could not load cart", 500);

  const items = await query(
    `select
       ci.id, ci.product_id, ci.variant_id, ci.quantity, ci.created_at,
       jsonb_build_object('name', p.name, 'slug', p.slug, 'price', p.price) as products,
       case when v.id is null then null
         else jsonb_build_object('name', v.name, 'sku', v.sku, 'price', v.price)
       end as product_variants
     from cart_items ci
     join products p on p.id = ci.product_id
     left join product_variants v on v.id = ci.variant_id
     where ci.cart_id = $1`,
    [cart.id]
  );

  return ok({ cart, items });
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cart:own");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    productId?: string;
    variantId?: string;
    quantity?: number;
  } | null;

  if (!body?.productId) return fail("productId is required");
  const quantity = Math.max(1, Number(body.quantity ?? 1));

  const cart = await getOrCreateCart(ctx.userId);
  if (!cart) return fail("Could not load cart", 500);

  const existing = await queryOne<{ id: string; quantity: number }>(
    `select id, quantity from cart_items
     where cart_id = $1 and product_id = $2 and variant_id is not distinct from $3`,
    [cart.id, body.productId, body.variantId ?? null]
  );

  if (existing) {
    const data = await queryOne(
      `update cart_items set quantity = $2 where id = $1 returning *`,
      [existing.id, existing.quantity + quantity]
    );
    return ok(data);
  }

  const data = await queryOne(
    `insert into cart_items (cart_id, product_id, variant_id, quantity)
     values ($1, $2, $3, $4)
     returning *`,
    [cart.id, body.productId, body.variantId ?? null, quantity]
  );

  await query(`update carts set updated_at = now() where id = $1`, [cart.id]);
  return ok(data, 201);
}

export async function DELETE(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cart:own");
  if (error || !ctx) return error;

  const itemId = new URL(request.url).searchParams.get("itemId");
  if (!itemId) return fail("itemId is required");

  const cart = await getOrCreateCart(ctx.userId);
  if (!cart) return fail("Could not load cart", 500);

  await query(`delete from cart_items where id = $1 and cart_id = $2`, [itemId, cart.id]);

  return ok({ deleted: itemId });
}
