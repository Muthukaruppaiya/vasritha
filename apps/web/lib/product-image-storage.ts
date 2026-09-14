import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { queryOne } from "./db/pool";
import { createServiceSupabaseClient } from "./supabase/server";

const BUCKET = "product-images";

export function resolveMediaUrl(storagePath: string | null | undefined): string {
  const value = String(storagePath || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function hasSupabaseStorage() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
}

let bucketReady: Promise<boolean> | null = null;

async function runEnsureProductImagesBucket() {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return false;

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("[product-images] listBuckets:", listError.message);
    return false;
  }
  if (buckets?.some((bucket) => bucket.name === BUCKET)) return true;

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"]
  });
  if (error) {
    console.error("[product-images] createBucket:", error.message);
    return false;
  }
  return true;
}

export async function ensureProductImagesBucket() {
  if (!bucketReady) {
    bucketReady = runEnsureProductImagesBucket().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  return bucketReady;
}

async function saveProductImageToDatabase(input: {
  productId: string;
  buffer: Buffer;
  mime: string;
}) {
  const row = await queryOne<{ id: string }>(
    `insert into public.product_image_blobs (product_id, mime, bytes)
     values ($1, $2, $3)
     returning id`,
    [input.productId, input.mime || "image/jpeg", input.buffer]
  );
  if (!row?.id) {
    throw new Error("Could not store image in database");
  }
  return { path: `/api/media/${row.id}` };
}

export async function saveProductImage(input: {
  productId: string;
  kind: "website" | "internal";
  buffer: Buffer;
  mime: string;
  ext: string;
}) {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${input.ext}`;
  const sub = input.kind === "internal" ? "internal" : "website";
  const objectKey = `${input.productId}/${sub}/${filename}`;

  if (hasSupabaseStorage()) {
    const supabase = createServiceSupabaseClient();
    if (supabase) {
      await ensureProductImagesBucket();
      const { error } = await supabase.storage.from(BUCKET).upload(objectKey, input.buffer, {
        contentType: input.mime,
        upsert: false
      });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectKey);
      return { path: data.publicUrl };
    }
  }

  // Hosted (Vercel) without Supabase Storage keys → store in Postgres and serve via /api/media.
  if (process.env.VERCEL || process.env.NETLIFY || process.env.NODE_ENV === "production") {
    try {
      return await saveProductImageToDatabase({
        productId: input.productId,
        buffer: input.buffer,
        mime: input.mime
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database image storage failed";
      throw new Error(
        `${message}. Or set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel for Supabase Storage.`
      );
    }
  }

  const dir = path.join(process.cwd(), "public", "uploads", "products", input.productId, sub);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), input.buffer);
  return { path: `/uploads/products/${input.productId}/${sub}/${filename}` };
}

export async function readProductImageBlob(id: string) {
  return queryOne<{ mime: string; bytes: Buffer }>(
    `select mime, bytes from public.product_image_blobs where id = $1`,
    [id]
  );
}

export function extensionFor(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}
