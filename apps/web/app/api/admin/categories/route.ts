import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";
import { mergeCategoryNameI18n } from "../../../../lib/i18n/category-names";

export async function GET() {
  const data = await query(
    `select
       c.id, c.name, c.slug, c.description, c.image_path, c.sort_order, c.name_i18n, c.created_at,
       coalesce(
         (
           select json_agg(
             json_build_object(
               'id', s.id,
               'name', s.name,
               'slug', s.slug,
               'sort_order', s.sort_order
             )
             order by s.sort_order asc, s.name asc
           )
           from subcategories s
           where s.category_id = c.id
         ),
         '[]'::json
       ) as subcategories
     from categories c
     order by c.sort_order asc`
  );
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "categories:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    slug?: string;
    description?: string;
    sort_order?: number;
    image_path?: string | null;
    name_i18n?: unknown;
  } | null;

  if (!body?.name || !body?.slug) return fail("name and slug are required");

  const nameI18n = mergeCategoryNameI18n({
    slug: body.slug,
    name: body.name,
    nameI18n: body.name_i18n
  });

  const data = await queryOne(
    `insert into categories (name, slug, description, image_path, sort_order, name_i18n)
     values ($1, $2, $3, $4, $5, $6::jsonb)
     returning *`,
    [
      body.name,
      body.slug,
      body.description ?? null,
      body.image_path ?? null,
      body.sort_order ?? 0,
      JSON.stringify(nameI18n)
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "categories",
    entityId: (data as { id: string }).id,
    after: data
  });

  return ok(data, 201);
}
