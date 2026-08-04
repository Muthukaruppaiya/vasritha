import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

export async function GET() {
  const data = await query(`select * from taxes order by name asc`);
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    code?: string;
    rate?: number;
    is_inclusive?: boolean;
  } | null;

  if (!body?.name || !body?.code || body.rate == null) {
    return fail("name, code and rate are required");
  }

  const data = await queryOne(
    `insert into taxes (name, code, rate, is_inclusive)
     values ($1, $2, $3, $4)
     returning *`,
    [body.name, body.code, body.rate, body.is_inclusive ?? false]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "taxes",
    entityId: (data as { id: string }).id,
    after: data
  });
  return ok(data, 201);
}
