import { NextRequest } from "next/server";
import { fail, ok, requireAnyPermission, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { queryOne } from "../../../../lib/db/pool";
import {
  ensureBrandsSchema,
  listBrands,
  normalizeBrandCode,
  setDefaultBrand,
  slugifyBrand,
  type BrandRow
} from "../../../../lib/brands";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "1";

  const { error } = activeOnly
    ? await requireAnyPermission(request, [
        "settings:business",
        "pos:create",
        "products:manage",
        "products:read",
        "config:all"
      ])
    : await requirePermission(request, "settings:business");
  if (error) return error;

  await ensureBrandsSchema();
  const data = await listBrands({ activeOnly });
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  await ensureBrandsSchema();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.name) return fail("Brand name is required");

  const code = normalizeBrandCode(body.code || body.name);
  if (!code) return fail("Brand code is required");

  const slug = slugifyBrand(body.slug || body.name) || slugifyBrand(code);
  if (!slug) return fail("Brand slug is required");

  const codeClash = await queryOne<{ id: string }>(
    `select id from brands where lower(code) = lower($1)`,
    [code]
  );
  if (codeClash) return fail(`Brand code ${code} already exists`);

  const slugClash = await queryOne<{ id: string }>(
    `select id from brands where lower(slug) = lower($1)`,
    [slug]
  );
  if (slugClash) return fail(`Brand slug ${slug} already exists`);

  const count = await queryOne<{ c: number }>(`select count(*)::int as c from brands`);
  const isFirst = !Number(count?.c || 0);
  const makeDefault = Boolean(body.is_default) || isFirst;

  const created = await queryOne<BrandRow>(
    `insert into brands (
       code, name, slug, tagline, logo_path, support_email, support_phone,
       website_url, is_active, is_default, sort_order, notes
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     returning *`,
    [
      code,
      String(body.name).trim(),
      slug,
      body.tagline ? String(body.tagline).trim() : null,
      body.logo_path ? String(body.logo_path).trim() : null,
      body.support_email ? String(body.support_email).trim() : null,
      body.support_phone ? String(body.support_phone).trim() : null,
      body.website_url ? String(body.website_url).trim() : null,
      body.is_active === false ? false : true,
      makeDefault,
      body.sort_order != null ? Number(body.sort_order) : 0,
      body.notes ? String(body.notes).trim() : null
    ]
  );

  if (!created) return fail("Could not create brand", 500);
  if (makeDefault) await setDefaultBrand(created.id);

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "brands",
    entityId: created.id,
    after: created
  });

  return ok(created, 201);
}
