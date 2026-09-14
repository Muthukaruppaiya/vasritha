import { NextRequest } from "next/server";
import { fail, ok } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";
import { extensionFor, resolveMediaUrl, saveProductImage } from "../../../../lib/product-image-storage";
import { ensureProductUnitsSchema } from "../../../../lib/product-units";
import { parseProductImageUploadKind } from "../../../../lib/product-upload-url";

type Params = { params: Promise<{ token: string }> };

const MAX_IMAGES = 5;
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function kindFromRequest(request: NextRequest, form?: FormData | null) {
  const fromQuery = request.nextUrl.searchParams.get("kind");
  const fromForm = form?.get("kind");
  const raw = typeof fromForm === "string" && fromForm ? fromForm : fromQuery;
  return parseProductImageUploadKind(raw);
}

export async function GET(request: NextRequest, { params }: Params) {
  await ensureProductUnitsSchema();
  const { token } = await params;
  const kind = kindFromRequest(request);
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
    [product.id, kind]
  );

  return ok({
    name: product.name,
    sku: product.sku,
    tag: product.tag,
    kind,
    images: images.map((image) => ({
      ...image,
      storage_path: resolveMediaUrl(image.storage_path)
    })),
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

  const form = await request.formData().catch(() => null);
  if (!form) return fail("Invalid upload");
  const kind = kindFromRequest(request, form);

  const existing = await queryOne<{ count: string }>(
    `select count(*)::text as count from product_images
     where product_id = $1 and image_kind = $2`,
    [product.id, kind]
  );
  const count = Number(existing?.count ?? 0);
  if (count >= MAX_IMAGES) {
    return fail(
      kind === "internal"
        ? `Maximum ${MAX_IMAGES} internal photos allowed`
        : `Maximum ${MAX_IMAGES} website photos allowed`,
      400
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) return fail("file is required");
  if (!ALLOWED.has(file.type)) return fail("Only JPEG, PNG, WebP or GIF images are allowed");
  if (file.size > MAX_BYTES) return fail("Each image must be under 4MB");

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extensionFor(file.type);

  let storagePath: string;
  try {
    const saved = await saveProductImage({
      productId: product.id,
      kind,
      buffer,
      mime: file.type,
      ext
    });
    storagePath = saved.path;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Upload failed", 500);
  }

  const alt =
    kind === "internal" ? "Internal reference (phone)" : "Product photo (phone)";

  const data = await queryOne(
    `insert into product_images (product_id, storage_path, alt_text, sort_order, image_kind)
     values ($1, $2, $3, $4, $5)
     returning id, storage_path, sort_order, image_kind`,
    [product.id, storagePath, alt, count, kind]
  );

  return ok(
    data
      ? {
          ...data,
          storage_path: resolveMediaUrl((data as { storage_path: string }).storage_path)
        }
      : data,
    201
  );
}
