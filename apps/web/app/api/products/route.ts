import { createPublicSupabaseClient } from "../../../lib/supabase/server";

export async function GET() {
  const supabase = createPublicSupabaseClient();

  if (!supabase) {
    return Response.json(
      { error: "Supabase is not configured. Add the public project URL and key to apps/web/.env.local." },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, description, price, compare_at_price, stock_quantity, status")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}
