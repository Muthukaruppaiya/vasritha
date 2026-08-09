import { NextRequest } from "next/server";
import { cachedOk, fail } from "../../../lib/auth/api";
import { query, queryOne } from "../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const category = searchParams.get("category");

  if (slug) {
    const data = await queryOne(
      `select id, name, slug, description, image_path, sort_order from categories where slug = $1`,
      [slug]
    );
    if (!data) return fail("Category not found", 404);
    return cachedOk(data);
  }

  const filterSlug = category ?? null;
  const data = await query(
    `select id, name, slug, description, image_path, sort_order
     from categories
     where ($1::text is null or slug = $1)
     order by sort_order asc`,
    [filterSlug]
  );
  return cachedOk(data);
}
