import { NextRequest } from "next/server";
import { ok } from "../../../lib/auth/api";
import { listActiveProducts } from "../../../lib/catalog";

export async function GET(request: NextRequest) {
  const category = new URL(request.url).searchParams.get("category");
  const data = await listActiveProducts({
    categorySlug: category || undefined
  });
  return ok(data);
}
