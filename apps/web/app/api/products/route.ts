import { NextRequest } from "next/server";
import { cachedOk } from "../../../lib/auth/api";
import { listActiveProducts } from "../../../lib/catalog";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const category = params.get("category");
  const mode = params.get("mode") === "card" ? "card" : "detail";
  const featuredOnly = params.get("featured") === "1" || params.get("featured") === "true";
  const limitRaw = Number(params.get("limit") || "");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  const data = await listActiveProducts({
    categorySlug: category || undefined,
    mode,
    featuredOnly,
    limit
  });
  return cachedOk(data);
}
