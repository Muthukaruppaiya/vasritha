import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";

export async function GET(request: NextRequest) {
  const pageSlug = new URL(request.url).searchParams.get("page") ?? "home";

  const sections = await query<{ id: string }>(
    `select * from page_sections
     where page_slug = $1 and is_active = true
     order by sort_order asc`,
    [pageSlug]
  );

  const sectionIds = sections.map((s) => s.id);
  const sectionItems = sectionIds.length
    ? await query(`select * from section_items where section_id = any($1::uuid[])`, [sectionIds])
    : [];

  const data = sections.map((section) => ({
    ...section,
    section_items: sectionItems.filter(
      (item) => (item as { section_id: string }).section_id === section.id
    )
  }));

  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cms:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.section_type) return fail("section_type is required");

  const data = await queryOne(
    `insert into page_sections (page_slug, section_type, title, subtitle, eyebrow, cta_label, cta_link, sort_order, is_active, settings)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     returning *`,
    [
      body.page_slug ?? "home",
      body.section_type,
      body.title ?? null,
      body.subtitle ?? null,
      body.eyebrow ?? null,
      body.cta_label ?? null,
      body.cta_link ?? null,
      body.sort_order ?? 0,
      body.is_active ?? true,
      JSON.stringify(body.settings ?? {})
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "page_sections",
    entityId: (data as { id: string }).id,
    after: data
  });
  return ok(data, 201);
}
