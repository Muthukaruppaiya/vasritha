import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const slug = new URL(request.url).searchParams.get("slug");

  if (slug) {
    const data = await queryOne(`select * from website_pages where slug = $1`, [slug]);
    if (!data) return fail("Page not found", 404);
    return ok(data);
  }

  const data = await query(`select id, slug, title, is_published, updated_at from website_pages`);
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cms:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    slug?: string;
    title?: string;
    body?: string;
    is_published?: boolean;
  } | null;

  if (!body?.slug || !body?.title) return fail("slug and title are required");

  const data = await queryOne(
    `insert into website_pages (slug, title, body, is_published, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (slug) do update set
       title = excluded.title,
       body = excluded.body,
       is_published = excluded.is_published,
       updated_at = now()
     returning *`,
    [body.slug, body.title, body.body ?? "", body.is_published ?? false]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "upsert",
    entityType: "website_pages",
    entityId: (data as { id: string }).id,
    after: data
  });
  return ok(data, 201);
}
