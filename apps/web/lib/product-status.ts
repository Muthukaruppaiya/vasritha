import type { QueryResultRow } from "pg";
import { query } from "./db/pool";
import type { AppRole, Permission } from "./auth/rbac";
import { hasPermission } from "./auth/rbac";

export const PRODUCT_STATUSES = [
  "draft",
  "pending_approval",
  "rejected",
  "active",
  "archived"
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

const APPROVE_PERMISSION: Permission = "products:approve";

let statusEnumReady: Promise<void> | null = null;

export async function ensureProductStatusEnum() {
  if (!statusEnumReady) {
    statusEnumReady = (async () => {
      await query(`
        do $$ begin
          alter type public.product_status add value if not exists 'pending_approval';
        exception when duplicate_object then null;
        end $$;
      `);
      await query(`
        do $$ begin
          alter type public.product_status add value if not exists 'rejected';
        exception when duplicate_object then null;
        end $$;
      `);
    })();
  }
  await statusEnumReady;
}

export function canApproveProducts(roles: AppRole[]) {
  return hasPermission(roles, APPROVE_PERMISSION);
}

export function normalizeProductStatus(
  value: unknown,
  options: { canApprove: boolean; fallback?: ProductStatus }
): ProductStatus {
  const raw = String(value || "").toLowerCase().trim();
  const fallback = options.fallback ?? "pending_approval";
  const status = (PRODUCT_STATUSES as readonly string[]).includes(raw)
    ? (raw as ProductStatus)
    : fallback;

  if (status === "active" && !options.canApprove) {
    return "pending_approval";
  }
  return status;
}

export function isSellableProductStatus(status: string | null | undefined) {
  return status === "active";
}

type StatusDb = {
  query: <R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<R[]>;
};

/**
 * Pending products with no other product sharing their name, SKU or family barcode
 * go straight to Active. Duplicates stay pending for a manager to resolve.
 */
export async function autoApproveIfUnique(productId: string, db?: StatusDb) {
  const runner: StatusDb = db || { query };
  const rows = await runner.query<{ id: string }>(
    `update products p
     set status = 'active', updated_at = now()
     where p.id = $1
       and p.status::text = 'pending_approval'
       and not exists (
         select 1 from products o
         where o.id <> p.id
           and (
             lower(btrim(o.name)) = lower(btrim(p.name))
             or o.sku = p.sku
             or o.barcode = p.barcode
           )
       )
     returning p.id`,
    [productId]
  );
  return rows.length > 0;
}
