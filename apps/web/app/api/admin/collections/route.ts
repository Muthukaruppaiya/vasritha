import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

export async function GET() {
  const data = await query(
    `select id, name, slug, description from collections order by name asc`
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
  } | null;

  if (!body?.name || !body?.slug) return fail("name and slug are required");

  const data = await queryOne(
    `insert into collections (name, slug, description)
     values ($1, $2, $3)
     returning *`,
    [body.name, body.slug, body.description ?? null]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "collections",
    entityId: (data as { id: string }).id,
    after: data
  });
  return ok(data, 201);
}
