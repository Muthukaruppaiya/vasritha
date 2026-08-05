import { NextRequest } from "next/server";
import { fail, ok, requirePermission } from "../../../../../lib/auth/api";
import { ensurePosSchema, lookupSellable } from "../../../../../lib/pos";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "pos:create");
  if (error) return error;

  await ensurePosSchema();

  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (!q) return ok([]);

  const data = await lookupSellable(q);
  return ok(data);
}
