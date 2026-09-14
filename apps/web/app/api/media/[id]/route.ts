import { NextRequest, NextResponse } from "next/server";
import { readProductImageBlob } from "../../../../lib/product-image-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const row = await readProductImageBlob(id);
    if (!row?.bytes) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = Buffer.isBuffer(row.bytes) ? row.bytes : Buffer.from(row.bytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": row.mime || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(body.length)
      }
    });
  } catch (error) {
    console.error("[media GET]", error);
    return NextResponse.json({ error: "Could not load image" }, { status: 500 });
  }
}
