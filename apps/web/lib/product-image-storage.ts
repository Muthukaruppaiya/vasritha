import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { createServiceSupabaseClient } from "./supabase/server";

const BUCKET = "product-images";

export function resolveMediaUrl(storagePath: string | null | undefined): string {
  const value = String(storagePath || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function useRemoteStorage() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return true;
  }
  return Boolean(process.env.VERCEL);
}

export async function ensureProductImagesBucket() {
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
    fileSizeLimit: 4 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"]
  });
  if (error) {
    console.error("[product-images] createBucket:", error.message);
    return false;
  }
  return true;
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

  if (useRemoteStorage()) {
    const supabase = createServiceSupabaseClient();
    if (!supabase) {
      throw new Error(
        "Image storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel."
      );
    }
    await ensureProductImagesBucket();
    const { error } = await supabase.storage.from(BUCKET).upload(objectKey, input.buffer, {
      contentType: input.mime,
      upsert: false
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectKey);
    return { path: data.publicUrl };
  }

  const dir = path.join(process.cwd(), "public", "uploads", "products", input.productId, sub);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), input.buffer);
  return { path: `/uploads/products/${input.productId}/${sub}/${filename}` };
}

export function extensionFor(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}
