import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";

export async function GET() {
  const data = await query(
    `select * from payment_methods where is_active = true order by sort_order`
  );
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    code?: string;
    provider?: string;
    is_online?: boolean;
  } | null;

  if (!body?.name || !body?.code) return fail("name and code are required");

  const data = await queryOne(
    `insert into payment_methods (name, code, provider, is_online)
     values ($1, $2, $3, $4)
     returning *`,
    [body.name, body.code, body.provider ?? "manual", body.is_online ?? true]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "payment_methods",
    entityId: (data as { id: string }).id,
    after: data
  });
  return ok(data, 201);
}
