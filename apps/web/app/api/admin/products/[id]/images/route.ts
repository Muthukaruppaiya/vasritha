import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../../lib/db/pool";
import { extensionFor, saveProductImage } from "../../../../../../lib/product-image-storage";
import { ensureProductUnitsSchema } from "../../../../../../lib/product-units";

type Params = { params: Promise<{ id: string }> };

export type ProductImageKind = "website" | "internal";

const MAX_IMAGES = 5;
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function parseKind(raw: string | null | undefined): ProductImageKind {
  return raw === "internal" ? "internal" : "website";
}

export async function GET(request: NextRequest, { params }: Params) {
  const { error } = await requirePermission(request, "products:read");
  if (error) return error;
  await ensureProductUnitsSchema();
  const { id } = await params;
  const kindParam = new URL(request.url).searchParams.get("kind");
  const kindFilter = kindParam === "website" || kindParam === "internal" ? kindParam : null;

  const data = await query(
    kindFilter
      ? `select * from product_images
         where product_id = $1 and image_kind = $2
         order by sort_order asc`
      : `select * from product_images where product_id = $1 order by sort_order asc`,
    kindFilter ? [id, kindFilter] : [id]
  );
  return ok(data);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;
  await ensureProductUnitsSchema();
  const { id: productId } = await params;

  const product = await queryOne(`select id from products where id = $1`, [productId]);
  if (!product) return fail("Product not found", 404);

  const contentType = request.headers.get("content-type") || "";
  let kind: ProductImageKind = "website";
  let altText: string | null = null;
  let sortOrderOverride: number | undefined;

  // JSON path: { storage_path } for remote/static paths, or { dataUrl, alt_text, kind }
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      storage_path?: string;
      dataUrl?: string;
      alt_text?: string;
      sort_order?: number;
      kind?: string;
      image_kind?: string;
    } | null;

    kind = parseKind(body?.kind || body?.image_kind);
    altText = body?.alt_text ?? null;
    sortOrderOverride = body?.sort_order;

    const existing = await queryOne<{ count: string }>(
      `select count(*)::text as count from product_images
       where product_id = $1 and image_kind = $2`,
      [productId, kind]
    );
    const count = Number(existing?.count ?? 0);
    if (count >= MAX_IMAGES) {
      return fail(`Maximum ${MAX_IMAGES} ${kind} images allowed`, 400);
    }

    if (body?.dataUrl) {
      const saved = await saveDataUrl(productId, body.dataUrl, count, kind);
      if ("error" in saved) return fail(saved.error, 400);

      const data = await queryOne(
        `insert into product_images (product_id, storage_path, alt_text, sort_order, image_kind)
         values ($1, $2, $3, $4, $5)
         returning *`,
        [productId, saved.path, altText, sortOrderOverride ?? count, kind]
      );

      await writeAuditLog({
        actorUserId: ctx.userId,
        action: "create",
        entityType: "product_images",
        entityId: (data as { id: string }).id,
        after: data
      });
      return ok(data, 201);
    }

    if (!body?.storage_path) return fail("storage_path or dataUrl is required");

    const data = await queryOne(
      `insert into product_images (product_id, storage_path, alt_text, sort_order, image_kind)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [productId, body.storage_path, altText, sortOrderOverride ?? count, kind]
    );

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "create",
      entityType: "product_images",
      entityId: (data as { id: string }).id,
      after: data
    });
    return ok(data, 201);
  }

  // multipart form-data: field "file", optional "kind"
  const form = await request.formData().catch(() => null);
  if (!form) return fail("Invalid upload");

  kind = parseKind(form.get("kind")?.toString() || form.get("image_kind")?.toString());
  altText = form.get("alt_text")?.toString() || null;

  const existing = await queryOne<{ count: string }>(
    `select count(*)::text as count from product_images
     where product_id = $1 and image_kind = $2`,
    [productId, kind]
  );
  const count = Number(existing?.count ?? 0);
  if (count >= MAX_IMAGES) {
    return fail(`Maximum ${MAX_IMAGES} ${kind} images allowed`, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return fail("file is required");
  if (!ALLOWED.has(file.type)) return fail("Only JPEG, PNG, WebP or GIF images are allowed");
  if (file.size > MAX_BYTES) return fail("Each image must be under 4MB");

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extensionFor(file.type);
  const sub = kind === "internal" ? "internal" : "website";

  let storagePath: string;
  try {
    const saved = await saveProductImage({
      productId,
      kind,
      buffer,
      mime: file.type,
      ext
    });
    storagePath = saved.path;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Upload failed", 500);
  }

  const data = await queryOne(
    `insert into product_images (product_id, storage_path, alt_text, sort_order, image_kind)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [productId, storagePath, altText, count, kind]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "product_images",
    entityId: (data as { id: string }).id,
    after: data
  });

  return ok(data, 201);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;
  const { id: productId } = await params;
  const imageId = new URL(request.url).searchParams.get("imageId");
  if (!imageId) return fail("imageId is required");

  const before = await queryOne(
    `select * from product_images where id = $1 and product_id = $2`,
    [imageId, productId]
  );
  if (!before) return fail("Image not found", 404);

  await query(`delete from product_images where id = $1`, [imageId]);

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "delete",
    entityType: "product_images",
    entityId: imageId,
    before
  });

  return ok({ deleted: imageId });
}

async function saveDataUrl(
  productId: string,
  dataUrl: string,
  sortOrder: number,
  kind: ProductImageKind
) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return { error: "Invalid image data" };
  const mime = match[1];
  if (!ALLOWED.has(mime)) return { error: "Only JPEG, PNG, WebP or GIF images are allowed" };
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) return { error: "Each image must be under 4MB" };

  const ext = extensionFor(mime);
  try {
    const saved = await saveProductImage({
      productId,
      kind,
      buffer,
      mime,
      ext
    });
    return { path: saved.path };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Upload failed" };
  }
}
