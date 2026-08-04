import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

type Wishlist = { id: string; customer_id: string; name: string; created_at: string };

async function getOrCreateWishlist(customerId: string): Promise<Wishlist | null> {
  const existing = await queryOne<Wishlist>(
    `select * from wishlists where customer_id = $1 and name = 'Default'`,
    [customerId]
  );
  if (existing) return existing;

  return queryOne<Wishlist>(
    `insert into wishlists (customer_id, name) values ($1, 'Default') returning *`,
    [customerId]
  );
}

export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "wishlist:own");
  if (error || !ctx) return error;

  const wishlist = await getOrCreateWishlist(ctx.userId);
  if (!wishlist) return fail("Could not load wishlist", 500);

  const items = await query(
    `select
       wi.id, wi.product_id, wi.variant_id, wi.created_at,
       jsonb_build_object('name', p.name, 'slug', p.slug, 'price', p.price) as products
     from wishlist_items wi
     join products p on p.id = wi.product_id
     where wi.wishlist_id = $1`,
    [wishlist.id]
  );

  return ok({ wishlist, items });
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "wishlist:own");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    productId?: string;
    variantId?: string;
  } | null;
  if (!body?.productId) return fail("productId is required");

  const wishlist = await getOrCreateWishlist(ctx.userId);
  if (!wishlist) return fail("Could not load wishlist", 500);

  const data = await queryOne(
    `insert into wishlist_items (wishlist_id, product_id, variant_id)
     values ($1, $2, $3)
     returning *`,
    [wishlist.id, body.productId, body.variantId ?? null]
  );

  return ok(data, 201);
}

export async function DELETE(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "wishlist:own");
  if (error || !ctx) return error;

  const itemId = new URL(request.url).searchParams.get("itemId");
  if (!itemId) return fail("itemId is required");

  const wishlist = await getOrCreateWishlist(ctx.userId);
  if (!wishlist) return fail("Could not load wishlist", 500);

  await query(`delete from wishlist_items where id = $1 and wishlist_id = $2`, [itemId, wishlist.id]);

  return ok({ deleted: itemId });
}
