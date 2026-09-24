import { NextRequest } from "next/server";
import { cachedOk, ok } from "../../../lib/auth/api";
import { listActiveProducts } from "../../../lib/catalog";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const category = params.get("category");
  const mode = params.get("mode") === "card" ? "card" : "detail";
  const featuredOnly = params.get("featured") === "1" || params.get("featured") === "true";
  const q = (params.get("q") || "").trim();
  const limitRaw = Number(params.get("limit") || "");
  // Search needs a sensible page size; browsing can stay uncapped unless limited.
  const defaultLimit = q ? 48 : undefined;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? limitRaw
      : defaultLimit;

  const data = await listActiveProducts({
    categorySlug: category || undefined,
    mode,
    featuredOnly,
    limit,
    q: q || undefined
  });

  // Never cache personalized search results in CDN.
  if (q) return ok(data);
  return cachedOk(data);
}
