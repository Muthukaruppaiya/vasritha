import { query } from "../../../lib/db/pool";

export async function GET() {
  try {
    await query("select 1");
    return Response.json({ status: "ok", runtime: "nextjs-route-handler", db: "up" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database unreachable";
    return Response.json({ status: "degraded", runtime: "nextjs-route-handler", db: "down", error: message }, { status: 503 });
  }
}
