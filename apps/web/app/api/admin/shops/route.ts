import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { queryOne } from "../../../../lib/db/pool";
import {
  ensureShopsSchema,
  listShops,
  normalizeShopCode,
  setDefaultShop,
  type ShopRow
} from "../../../../lib/shops";
import { stateCodeFromGstin } from "../../../../lib/gst";
import { ensureBrandsSchema, resolveBrandId } from "../../../../lib/brands";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "1";

  // POS cashiers can list active shops; full list needs settings
  const { error } = activeOnly
    ? await requireAnyPermission(request, ["settings:business", "pos:create", "stock:operate"])
    : await requirePermission(request, "settings:business");
  if (error) return error;

  await ensureShopsSchema();
  const data = await listShops({ activeOnly });
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  await ensureShopsSchema();
  await ensureBrandsSchema();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.name) return fail("Shop name is required");

  const code = normalizeShopCode(body.code || body.name);
  if (!code) return fail("Shop code is required (letters/numbers)");

  const existing = await queryOne<{ id: string }>(
    `select id from shops where lower(code) = lower($1)`,
    [code]
  );
  if (existing) return fail(`Shop code ${code} already exists`);

  const gstin = body.gstin
    ? String(body.gstin).trim().toUpperCase()
    : null;
  const stateCode =
    (body.state_code ? String(body.state_code).replace(/\D/g, "").slice(0, 2) : "") ||
    stateCodeFromGstin(gstin) ||
    null;

  const makeDefault = Boolean(body.is_default);
  const count = await queryOne<{ c: number }>(`select count(*)::int as c from shops`);
  const isFirst = !Number(count?.c || 0);
  const brandId = await resolveBrandId(
    body.brand_id != null ? String(body.brand_id) : null
  );

  const created = await queryOne<ShopRow>(
    `insert into shops (
       code, name, address, phone, email, state, state_code, gstin, brand_id,
       is_active, is_default, notes
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     returning *`,
    [
      code,
      String(body.name).trim(),
      body.address ? String(body.address).trim() : null,
      body.phone ? String(body.phone).trim() : null,
      body.email ? String(body.email).trim() : null,
      body.state ? String(body.state).trim() : null,
      stateCode,
      gstin,
      brandId,
      body.is_active === false ? false : true,
      isFirst || makeDefault,
      body.notes ? String(body.notes).trim() : null
    ]
  );

  if (!created) return fail("Could not create shop", 500);

  if (makeDefault || isFirst) {
    await setDefaultShop(created.id);
  }

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "shops",
    entityId: created.id,
    after: created
  });

  return ok(created, 201);
}
