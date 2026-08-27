import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";
import {
  ensureBrandsSchema,
  getBrandById,
  normalizeBrandCode,
  setDefaultBrand,
  slugifyBrand,
  type BrandRow
} from "../../../../../lib/brands";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requirePermission(_request, "settings:business");
  if (error) return error;

  const { id } = await params;
  const brand = await getBrandById(id);
  if (!brand) return fail("Brand not found", 404);
  return ok(brand);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  await ensureBrandsSchema();
  const { id } = await params;
  const before = await getBrandById(id);
  if (!before) return fail("Brand not found", 404);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Invalid body");

  const updates: string[] = [];
  const values: unknown[] = [];

  if ("name" in body) {
    const name = String(body.name || "").trim();
    if (!name) return fail("Brand name is required");
    values.push(name);
    updates.push(`name = $${values.length}`);
  }
  if ("code" in body) {
    const code = normalizeBrandCode(body.code);
    if (!code) return fail("Brand code is required");
    const clash = await queryOne<{ id: string }>(
      `select id from brands where lower(code) = lower($1) and id <> $2`,
      [code, id]
    );
    if (clash) return fail(`Brand code ${code} already exists`);
    values.push(code);
    updates.push(`code = $${values.length}`);
  }
  if ("slug" in body) {
    const slug = slugifyBrand(body.slug);
    if (!slug) return fail("Brand slug is required");
    const clash = await queryOne<{ id: string }>(
      `select id from brands where lower(slug) = lower($1) and id <> $2`,
      [slug, id]
    );
    if (clash) return fail(`Brand slug ${slug} already exists`);
    values.push(slug);
    updates.push(`slug = $${values.length}`);
  }
  for (const key of [
    "tagline",
    "logo_path",
    "support_email",
    "support_phone",
    "website_url",
    "notes"
  ] as const) {
    if (key in body) {
      const raw = body[key];
      values.push(raw == null || String(raw).trim() === "" ? null : String(raw).trim());
      updates.push(`${key} = $${values.length}`);
    }
  }
  if ("sort_order" in body) {
    values.push(Number(body.sort_order) || 0);
    updates.push(`sort_order = $${values.length}`);
  }
  if ("is_active" in body) {
    values.push(Boolean(body.is_active));
    updates.push(`is_active = $${values.length}`);
  }

  if (!updates.length && !("is_default" in body)) {
    return fail("No fields to update");
  }

  let data = before;
  if (updates.length) {
    updates.push("updated_at = now()");
    values.push(id);
    const updated = await queryOne<BrandRow>(
      `update brands set ${updates.join(", ")} where id = $${values.length} returning *`,
      values
    );
    if (!updated) return fail("Update failed", 500);
    data = updated;
  }

  if (body.is_default === true) {
    if (!data.is_active) return fail("Cannot set an inactive brand as default");
    await setDefaultBrand(id);
    data = (await getBrandById(id)) || data;
  }

  if (body.is_active === false && data.is_default) {
    const other = await queryOne<{ id: string }>(
      `select id from brands where is_active = true and id <> $1 order by sort_order asc limit 1`,
      [id]
    );
    if (other) {
      await setDefaultBrand(other.id);
      data = (await getBrandById(id)) || data;
    } else {
      return fail("Keep at least one active default brand");
    }
  }

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "brands",
    entityId: id,
    before,
    after: data
  });

  return ok(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  await ensureBrandsSchema();
  const { id } = await params;
  const before = await getBrandById(id);
  if (!before) return fail("Brand not found", 404);

  const others = await queryOne<{ c: number }>(
    `select count(*)::int as c from brands where id <> $1`,
    [id]
  );
  if (!Number(others?.c || 0)) {
    return fail("Cannot delete the only brand. Add another brand first.");
  }

  if (before.is_default) {
    const other = await queryOne<{ id: string }>(
      `select id from brands where id <> $1 and is_active = true order by sort_order asc limit 1`,
      [id]
    );
    if (other) await setDefaultBrand(other.id);
  }

  const used = await queryOne<{ c: number }>(
    `select (
       (select count(*) from products where brand_id = $1) +
       (select count(*) from orders where brand_id = $1) +
       (select count(*) from shops where brand_id = $1)
     )::int as c`,
    [id]
  );

  if (Number(used?.c || 0) > 0) {
    await query(
      `update brands set is_active = false, is_default = false, updated_at = now() where id = $1`,
      [id]
    );
    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "deactivate",
      entityType: "brands",
      entityId: id,
      before
    });
    return ok({ id, deactivated: true });
  }

  await query(`delete from brands where id = $1`, [id]);
  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "delete",
    entityType: "brands",
    entityId: id,
    before
  });
  return ok({ id, deleted: true });
}
