import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";
import {
  ensureShopsSchema,
  getShopById,
  normalizeShopCode,
  setDefaultShop,
  type ShopRow
} from "../../../../../lib/shops";
import { stateCodeFromGstin } from "../../../../../lib/gst";
import { ensureBrandsSchema, resolveBrandId } from "../../../../../lib/brands";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { error } = await requirePermission(request, "settings:business");
  if (error) return error;

  const { id } = await params;
  const shop = await getShopById(id);
  if (!shop) return fail("Shop not found", 404);
  return ok(shop);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  await ensureShopsSchema();
  const { id } = await params;
  const before = await getShopById(id);
  if (!before) return fail("Shop not found", 404);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Invalid body");

  const updates: string[] = [];
  const values: unknown[] = [];

  if ("name" in body) {
    const name = String(body.name || "").trim();
    if (!name) return fail("Shop name is required");
    values.push(name);
    updates.push(`name = $${values.length}`);
  }
  if ("code" in body) {
    const code = normalizeShopCode(body.code);
    if (!code) return fail("Shop code is required");
    const clash = await queryOne<{ id: string }>(
      `select id from shops where lower(code) = lower($1) and id <> $2`,
      [code, id]
    );
    if (clash) return fail(`Shop code ${code} already exists`);
    values.push(code);
    updates.push(`code = $${values.length}`);
  }
  for (const key of ["address", "phone", "email", "state", "notes"] as const) {
    if (key in body) {
      const raw = body[key];
      values.push(raw == null || String(raw).trim() === "" ? null : String(raw).trim());
      updates.push(`${key} = $${values.length}`);
    }
  }
  if ("gstin" in body) {
    const gstin =
      body.gstin == null || String(body.gstin).trim() === ""
        ? null
        : String(body.gstin).trim().toUpperCase();
    values.push(gstin);
    updates.push(`gstin = $${values.length}`);
    if (!("state_code" in body) && gstin) {
      const derived = stateCodeFromGstin(gstin);
      if (derived) {
        values.push(derived);
        updates.push(`state_code = $${values.length}`);
      }
    }
  }
  if ("state_code" in body) {
    const code =
      body.state_code == null || String(body.state_code).trim() === ""
        ? null
        : String(body.state_code).replace(/\D/g, "").slice(0, 2);
    values.push(code);
    updates.push(`state_code = $${values.length}`);
  }
  if ("is_active" in body) {
    values.push(Boolean(body.is_active));
    updates.push(`is_active = $${values.length}`);
  }
  if ("brand_id" in body) {
    await ensureBrandsSchema();
    const brandId = await resolveBrandId(
      body.brand_id == null || String(body.brand_id).trim() === ""
        ? null
        : String(body.brand_id)
    );
    values.push(brandId);
    updates.push(`brand_id = $${values.length}`);
  }

  if (!updates.length && !("is_default" in body)) {
    return fail("No fields to update");
  }

  let data = before;
  if (updates.length) {
    updates.push("updated_at = now()");
    values.push(id);
    const updated = await queryOne<ShopRow>(
      `update shops set ${updates.join(", ")} where id = $${values.length} returning *`,
      values
    );
    if (!updated) return fail("Update failed", 500);
    data = updated;
  }

  if (body.is_default === true) {
    if (!data.is_active) return fail("Cannot set an inactive shop as default");
    await setDefaultShop(id);
    data = (await getShopById(id)) || data;
  }

  if (body.is_active === false && data.is_default) {
    const other = await queryOne<{ id: string }>(
      `select id from shops where is_active = true and id <> $1 order by created_at asc limit 1`,
      [id]
    );
    if (other) {
      await setDefaultShop(other.id);
      data = (await getShopById(id)) || data;
    } else {
      return fail("Keep at least one active default shop");
    }
  }

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "shops",
    entityId: id,
    before,
    after: data
  });

  return ok(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  await ensureShopsSchema();
  const { id } = await params;
  const before = await getShopById(id);
  if (!before) return fail("Shop not found", 404);

  const others = await queryOne<{ c: number }>(
    `select count(*)::int as c from shops where id <> $1`,
    [id]
  );
  if (!Number(others?.c || 0)) {
    return fail("Cannot delete the only shop. Add another shop first.");
  }

  // Soft-delete preferred: deactivate + clear default
  if (before.is_default) {
    const other = await queryOne<{ id: string }>(
      `select id from shops where id <> $1 and is_active = true order by created_at asc limit 1`,
      [id]
    );
    if (other) await setDefaultShop(other.id);
  }

  const used = await queryOne<{ c: number }>(
    `select (
       (select count(*) from orders where shop_id = $1) +
       (select count(*) from inventory_movements where shop_id = $1) +
       (select count(*) from product_items where shop_id = $1)
     )::int as c`,
    [id]
  );

  if (Number(used?.c || 0) > 0) {
    await query(
      `update shops set is_active = false, is_default = false, updated_at = now() where id = $1`,
      [id]
    );
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "deactivate",
      entityType: "shops",
      entityId: id,
      before
    });
    return ok({ id, deactivated: true });
  }

  await query(`delete from shops where id = $1`, [id]);
  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "delete",
    entityType: "shops",
    entityId: id,
    before
  });
  return ok({ id, deleted: true });
}
