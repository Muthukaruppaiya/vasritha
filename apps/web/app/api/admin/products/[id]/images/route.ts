import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../../lib/db/pool";

type Params = { params: Promise<{ id: string }> };

const MAX_IMAGES = 5;
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function GET(request: NextRequest, { params }: Params) {
  const { error } = await requirePermission(request, "products:read");
  if (error) return error;
  const { id } = await params;

  const data = await query(
    `select * from product_images where product_id = $1 order by sort_order asc`,
    [id]
  );
  return ok(data);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;
  const { id: productId } = await params;

  const product = await queryOne(`select id from products where id = $1`, [productId]);
  if (!product) return fail("Product not found", 404);

  const existing = await queryOne<{ count: string }>(
    `select count(*)::text as count from product_images where product_id = $1`,
    [productId]
  );
  const count = Number(existing?.count ?? 0);
  if (count >= MAX_IMAGES) return fail(`Maximum ${MAX_IMAGES} images allowed`, 400);

  const contentType = request.headers.get("content-type") || "";

  // JSON path: { storage_path } for remote/static paths, or { dataUrl, alt_text }
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      storage_path?: string;
      dataUrl?: string;
      alt_text?: string;
      sort_order?: number;
    } | null;

    if (body?.dataUrl) {
      const saved = await saveDataUrl(productId, body.dataUrl, count);
      if ("error" in saved) return fail(saved.error, 400);

      const data = await queryOne(
        `insert into product_images (product_id, storage_path, alt_text, sort_order)
         values ($1, $2, $3, $4)
         returning *`,
        [productId, saved.path, body.alt_text ?? null, body.sort_order ?? count]
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
      `insert into product_images (product_id, storage_path, alt_text, sort_order)
       values ($1, $2, $3, $4)
       returning *`,
      [productId, body.storage_path, body.alt_text ?? null, body.sort_order ?? count]
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

  // multipart form-data: field "file"
  const form = await request.formData().catch(() => null);
  if (!form) return fail("Invalid upload");

  const file = form.get("file");
  if (!(file instanceof File)) return fail("file is required");
  if (!ALLOWED.has(file.type)) return fail("Only JPEG, PNG, WebP or GIF images are allowed");
  if (file.size > MAX_BYTES) return fail("Each image must be under 4MB");

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extensionFor(file.type);
  const dir = path.join(process.cwd(), "public", "uploads", "products", productId);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);
  const storagePath = `/uploads/products/${productId}/${filename}`;

  const data = await queryOne(
    `insert into product_images (product_id, storage_path, alt_text, sort_order)
     values ($1, $2, $3, $4)
     returning *`,
    [productId, storagePath, form.get("alt_text")?.toString() || null, count]
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

function extensionFor(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

async function saveDataUrl(productId: string, dataUrl: string, sortOrder: number) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return { error: "Invalid image data" };
  const mime = match[1];
  if (!ALLOWED.has(mime)) return { error: "Only JPEG, PNG, WebP or GIF images are allowed" };
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) return { error: "Each image must be under 4MB" };

  const ext = extensionFor(mime);
  const dir = path.join(process.cwd(), "public", "uploads", "products", productId);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${sortOrder}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);
  return { path: `/uploads/products/${productId}/${filename}` };
}
