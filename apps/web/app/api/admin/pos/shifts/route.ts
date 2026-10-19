import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query } from "../../../../../lib/db/pool";
import {
  buildShiftSalesSummary,
  closePosShift,
  ensurePosShiftSchema,
  getOpenShiftForShop,
  getOpenShiftForUser,
  listPosShifts,
  openPosShift
} from "../../../../../lib/pos-shifts";
import { requireScopedShopId } from "../../../../../lib/shop-scope";

export const runtime = "nodejs";

/** List shifts + current open shift for the shop. */
export async function GET(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "pos:create");
  if (error || !ctx) return error;

  await ensurePosShiftSchema();
  const { searchParams } = new URL(request.url);
  const preferredShop = searchParams.get("shopId");
  const limit = Number(searchParams.get("limit") || 10);
  const offset = Number(searchParams.get("offset") || 0);

  let shopId: string;
  try {
    shopId = (await requireScopedShopId(ctx, preferredShop)).shopId;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No active shop");
  }

  const [mine, shopOpen, listed] = await Promise.all([
    getOpenShiftForUser(shopId, ctx.userId),
    getOpenShiftForShop(shopId),
    listPosShifts({ shopId, limit, offset })
  ]);

  let liveSummary = null;
  if (mine) {
    liveSummary = await buildShiftSalesSummary({
      shopId,
      userId: mine.opened_by,
      shiftId: mine.id,
      from: mine.opened_at
    });
  }

  const staff = await query<{ id: string; full_name: string; email: string }>(
    `select u.id, u.full_name, u.email
     from users u
     where exists (
       select 1 from user_roles ur
       join roles r on r.id = ur.role_id
       where ur.user_id = u.id and r.code <> 'customer'
     )
     and (u.shop_id is null or u.shop_id = $1)
     order by u.full_name asc
     limit 100`,
    [shopId]
  );

  return ok({
    shopId,
    myOpen: mine,
    shopOpen,
    liveSummary,
    history: listed.rows,
    total: listed.total,
    limit: listed.limit,
    offset: listed.offset,
    staff
  });
}

/** Open a shift (POST) or close/handover (PATCH via action). */
export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "pos:create");
  if (error || !ctx) return error;

  await ensurePosShiftSchema();
  const body = (await request.json().catch(() => null)) as {
    shopId?: string;
    openingFloat?: number;
    notes?: string;
    action?: "open" | "close";
    shiftId?: string;
    closingCashCounted?: number;
    handoverTo?: string | null;
    openNextForHandover?: boolean;
  } | null;

  if (!body) return fail("Invalid body");

  let shopId: string;
  try {
    shopId = (await requireScopedShopId(ctx, body.shopId || null)).shopId;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "No active shop");
  }

  const action = body.action === "close" ? "close" : "open";

  try {
    if (action === "open") {
      const shift = await openPosShift({
        shopId,
        userId: ctx.userId,
        openingFloat: body.openingFloat,
        notes: body.notes
      });
      await writeAuditLog({
        actorUserId: ctx.userId,
        action: "pos_shift_open",
        entityType: "pos_shifts",
        entityId: shift.id,
        after: { shopId, openingFloat: shift.opening_float }
      });
      return ok({ shift }, 201);
    }

    const mine = await getOpenShiftForUser(shopId, ctx.userId);
    const shiftId = body.shiftId || mine?.id;
    if (!shiftId) return fail("No open shift to close");

    const closed = await closePosShift({
      shiftId,
      userId: ctx.userId,
      closingCashCounted: body.closingCashCounted,
      notes: body.notes,
      handoverTo: body.handoverTo || null
    });

    let nextShift = null;
    if (body.openNextForHandover && body.handoverTo) {
      nextShift = await openPosShift({
        shopId,
        userId: body.handoverTo,
        openingFloat: body.closingCashCounted ?? (Number(closed.shift.opening_float) || 0),
        notes: `Handover from previous shift`
      });
    }

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "pos_shift_close",
      entityType: "pos_shifts",
      entityId: closed.shift.id,
      after: {
        summary: closed.summary,
        handoverTo: body.handoverTo || null,
        nextShiftId: nextShift?.id || null
      }
    });

    return ok({
      shift: closed.shift,
      summary: closed.summary,
      nextShift
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Shift action failed", 400);
  }
}
