import type { AuthContext } from "./auth/api";
import { hasPermission } from "./auth/rbac";
import { query, queryOne } from "./db/pool";
import { skipEnsureIfRelationExists } from "./schema-bootstrap";
import {
  ensureShopsSchema,
  getDefaultShop,
  getShopById,
  resolveShopId
} from "./shops";

export type ShopScope =
  | { mode: "all"; shopId: string | null; shopName: string | null }
  | { mode: "one"; shopId: string; shopName: string | null };

/** Roles that may operate across all shops when users.shop_id is null. */
const ALL_SHOP_ROLES = new Set([
  "super_admin",
  "business_owner",
  "manager",
  "accountant"
]);

/** Staff roles that must be bound to a store on create/edit. */
export const STORE_BOUND_ROLE_CODES = new Set([
  "billing_staff",
  "inventory_staff",
  "packing_shipping_staff",
  "customer_support_staff"
]);

export function roleRequiresShop(roleCode: string) {
  return STORE_BOUND_ROLE_CODES.has(roleCode);
}

let shopStockSchemaReady: Promise<void> | null = null;

async function runEnsureShopStockSchema() {
  await ensureShopsSchema();
  await query(`
    alter table public.users
      add column if not exists shop_id uuid references public.shops(id)
  `);
  await query(`
    create index if not exists users_shop_id_idx
      on public.users (shop_id)
      where shop_id is not null
  `);
  await query(`
    create table if not exists public.shop_variant_stock (
      shop_id uuid not null references public.shops(id) on delete cascade,
      variant_id uuid not null references public.product_variants(id) on delete cascade,
      stock_quantity integer not null default 0,
      updated_at timestamptz not null default now(),
      primary key (shop_id, variant_id),
      constraint shop_variant_stock_qty_nonneg check (stock_quantity >= 0)
    )
  `);
  await query(`
    create index if not exists shop_variant_stock_variant_idx
      on public.shop_variant_stock (variant_id)
  `);
  await query(`
    create index if not exists product_items_shop_variant_status_idx
      on public.product_items (shop_id, variant_id, status)
  `);
  await query(`
    create index if not exists product_items_shop_to_sell_idx
      on public.product_items (shop_id, variant_id)
      where status = 'to_sell' and shop_id is not null
  `);
  await query(`
    create index if not exists inventory_movements_shop_created_idx
      on public.inventory_movements (shop_id, created_at desc)
      where shop_id is not null
  `);
}

export async function ensureShopStockSchema() {
  // Always keep shops FK columns current (shop_id on movements/items may lag).
  await ensureShopsSchema();
  if (await skipEnsureIfRelationExists("public.shop_variant_stock")) return;
  if (!shopStockSchemaReady) {
    shopStockSchemaReady = runEnsureShopStockSchema().catch((error) => {
      shopStockSchemaReady = null;
      throw error;
    });
  }
  return shopStockSchemaReady;
}

export async function getUserShopId(userId: string) {
  await ensureShopStockSchema();
  const row = await queryOne<{ shop_id: string | null }>(
    `select shop_id from users where id = $1`,
    [userId]
  );
  return row?.shop_id ?? null;
}

export async function getUserShopProfile(userId: string) {
  await ensureShopStockSchema();
  return queryOne<{
    shop_id: string | null;
    shop_name: string | null;
    shop_code: string | null;
  }>(
    `select u.shop_id, s.name as shop_name, s.code as shop_code
     from users u
     left join shops s on s.id = u.shop_id
     where u.id = $1`,
    [userId]
  );
}

/**
 * Resolve which shop a staff user may act on.
 * Bound users are forced to their shop_id. Unbound admins may pick preferredId.
 */
export async function resolveShopScope(
  ctx: AuthContext,
  preferredId?: string | null
): Promise<ShopScope> {
  await ensureShopStockSchema();
  const boundShopId = await getUserShopId(ctx.userId);

  if (boundShopId) {
    const shop = await getShopById(boundShopId);
    return {
      mode: "one",
      shopId: boundShopId,
      shopName: shop?.name ?? null
    };
  }

  const canAll =
    hasPermission(ctx.roles, "settings:business") ||
    ctx.roles.some((role) => ALL_SHOP_ROLES.has(role));

  if (!canAll) {
    // Unbound non-admin staff: fall back to default shop as a single-store scope.
    const fallback = await getDefaultShop();
    if (!fallback) {
      return { mode: "all", shopId: null, shopName: null };
    }
    return { mode: "one", shopId: fallback.id, shopName: fallback.name };
  }

  const shopId = await resolveShopId(preferredId || null);
  if (!shopId) {
    return { mode: "all", shopId: null, shopName: null };
  }
  const shop = await getShopById(shopId);
  return {
    mode: "all",
    shopId,
    shopName: shop?.name ?? null
  };
}

/** Enforce a concrete shop id for writes (POS/inventory). Throws-friendly null. */
export async function requireScopedShopId(
  ctx: AuthContext,
  preferredId?: string | null
): Promise<{ shopId: string; shopName: string | null; mode: "all" | "one" }> {
  const scope = await resolveShopScope(ctx, preferredId);
  if (scope.mode === "one") {
    return { shopId: scope.shopId, shopName: scope.shopName, mode: "one" };
  }
  const shopId = await resolveShopId(preferredId || scope.shopId);
  if (!shopId) {
    throw new Error("No active shop configured. Add a shop under System → Shops.");
  }
  const shop = await getShopById(shopId);
  return { shopId, shopName: shop?.name ?? null, mode: "all" };
}
