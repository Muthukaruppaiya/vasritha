import { NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fail, ok } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";
import { ensureProductUnitsSchema } from "../../../../lib/product-units";

type Params = { params: Promise<{ token: string }> };

const MAX_IMAGES = 5;
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Phone QR uploads are always internal reference photos (not website). */
const QR_KIND = "internal" as const;

export async function GET(_request: NextRequest, { params }: Params) {
  await ensureProductUnitsSchema();
  const { token } = await params;
  const product = await queryOne<{
    id: string;
    name: string;
    sku: string | null;
    tag: string | null;
  }>(
    `select id, name, sku, tag from products where image_upload_token = $1`,
    [token]
  );
  if (!product) return fail("Invalid or expired upload link", 404);

  const images = await query<{ id: string; storage_path: string; image_kind: string }>(
    `select id, storage_path, image_kind::text as image_kind
     from product_images
     where product_id = $1 and image_kind = $2
     order by sort_order asc`,
    [product.id, QR_KIND]
  );

  return ok({
    name: product.name,
    sku: product.sku,
    tag: product.tag,
    kind: QR_KIND,
    images,
    remaining: Math.max(0, MAX_IMAGES - images.length)
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  await ensureProductUnitsSchema();
  const { token } = await params;
  const product = await queryOne<{ id: string }>(
    `select id from products where image_upload_token = $1`,
    [token]
  );
  if (!product) return fail("Invalid or expired upload link", 404);

  const existing = await queryOne<{ count: string }>(
    `select count(*)::text as count from product_images
     where product_id = $1 and image_kind = $2`,
    [product.id, QR_KIND]
  );
  const count = Number(existing?.count ?? 0);
  if (count >= MAX_IMAGES) return fail(`Maximum ${MAX_IMAGES} internal reference photos allowed`, 400);

  const form = await request.formData().catch(() => null);
  if (!form) return fail("Invalid upload");
  const file = form.get("file");
  if (!(file instanceof File)) return fail("file is required");
  if (!ALLOWED.has(file.type)) return fail("Only JPEG, PNG, WebP or GIF images are allowed");
  if (file.size > MAX_BYTES) return fail("Each image must be under 4MB");

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const dir = path.join(process.cwd(), "public", "uploads", "products", product.id, "internal");
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);
  const storagePath = `/uploads/products/${product.id}/internal/${filename}`;

  const data = await queryOne(
    `insert into product_images (product_id, storage_path, alt_text, sort_order, image_kind)
     values ($1, $2, $3, $4, $5)
     returning id, storage_path, sort_order, image_kind`,
    [product.id, storagePath, "Internal reference (phone)", count, QR_KIND]
  );

  return ok(data, 201);
}
