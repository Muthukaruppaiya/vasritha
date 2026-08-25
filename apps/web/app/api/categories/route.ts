import { NextRequest } from "next/server";
import { cachedOk, fail } from "../../../lib/auth/api";
import { query, queryOne } from "../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const category = searchParams.get("category");

  if (slug) {
    const data = await queryOne(
      `select id, name, slug, description, image_path, sort_order, name_i18n from categories where slug = $1`,
      [slug]
    );
    if (!data) return fail("Category not found", 404);
    return cachedOk(data);
  }

  const filterSlug = category ?? null;
  const data = await query(
    `select
       c.id, c.name, c.slug, c.description, c.image_path, c.sort_order, c.name_i18n,
       coalesce(
         (
           select json_agg(
             json_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'sort_order', s.sort_order)
             order by s.sort_order asc, s.name asc
           )
           from subcategories s
           where s.category_id = c.id
         ),
         '[]'::json
       ) as subcategories
     from categories c
     where ($1::text is null or c.slug = $1)
     order by c.sort_order asc`,
    [filterSlug]
  );
  return cachedOk(data);
}
