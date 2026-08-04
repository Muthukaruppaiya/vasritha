import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";

export async function GET() {
  const menus = await query<{ id: string }>(`select * from menus where is_active = true`);

  const menuIds = menus.map((m) => m.id);
  const menuItems = menuIds.length
    ? await query(`select * from menu_items where menu_id = any($1::uuid[])`, [menuIds])
    : [];

  const data = menus.map((menu) => ({
    ...menu,
    menu_items: menuItems.filter((item) => (item as { menu_id: string }).menu_id === menu.id)
  }));

  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cms:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    menuId?: string;
    label?: string;
    link_type?: string;
    link_value?: string;
    parent_id?: string;
    sort_order?: number;
  } | null;

  if (!body?.menuId || !body?.label || !body?.link_type) {
    return fail("menuId, label and link_type are required");
  }

  const data = await queryOne(
    `insert into menu_items (menu_id, label, link_type, link_value, parent_id, sort_order)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      body.menuId,
      body.label,
      body.link_type,
      body.link_value ?? null,
      body.parent_id ?? null,
      body.sort_order ?? 0
    ]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "menu_items",
    entityId: (data as { id: string }).id,
    after: data
  });
  return ok(data, 201);
}
