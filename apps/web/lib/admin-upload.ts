import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { query, queryOne } from "./db/pool";
import { createServiceSupabaseClient } from "./supabase/server";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const BUCKET = "site-uploads";

function hasSupabaseStorage() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function isHostedRuntime() {
  return Boolean(
    process.env.VERCEL || process.env.NETLIFY || process.env.NODE_ENV === "production"
  );
}

let schemaReady: Promise<void> | null = null;
let bucketReady: Promise<boolean> | null = null;

async function ensureMediaBlobsSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`
        create table if not exists public.media_blobs (
          id uuid primary key default gen_random_uuid(),
          folder text not null default '',
          mime text not null,
          bytes bytea not null,
          created_at timestamptz not null default now()
        )
      `);
      await query(`
        alter table public.site_settings
          add column if not exists logo_path text,
          add column if not exists header_logo_path text,
          add column if not exists favicon_path text
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function ensureSiteUploadsBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = createServiceSupabaseClient();
      if (!supabase) return false;
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (listError) {
        console.error("[site-uploads] listBuckets:", listError.message);
        return false;
      }
      if (buckets?.some((bucket) => bucket.name === BUCKET)) return true;
      const { error } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 12 * 1024 * 1024,
        allowedMimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/svg+xml",
          "application/pdf",
          "video/mp4",
          "video/webm"
        ]
      });
      if (error) {
        console.error("[site-uploads] createBucket:", error.message);
        // Bucket may already exist from a race — treat as usable.
        if (/already exists/i.test(error.message)) return true;
        return false;
      }
      return true;
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  return bucketReady;
}

async function saveToSupabase(input: {
  folder: string;
  buffer: Buffer;
  mime: string;
  ext: string;
}) {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return null;
  const ok = await ensureSiteUploadsBucket();
  if (!ok) return null;

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${input.ext}`;
  const objectKey = `${input.folder.replace(/^\/+|\/+$/g, "")}/${filename}`;
  const { error } = await supabase.storage.from(BUCKET).upload(objectKey, input.buffer, {
    contentType: input.mime,
    upsert: false
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectKey);
  return { path: data.publicUrl };
}

async function saveToDatabase(input: {
  folder: string;
  buffer: Buffer;
  mime: string;
}) {
  await ensureMediaBlobsSchema();
  const row = await queryOne<{ id: string }>(
    `insert into public.media_blobs (folder, mime, bytes)
     values ($1, $2, $3)
     returning id`,
    [input.folder, input.mime || "application/octet-stream", input.buffer]
  );
  if (!row?.id) throw new Error("Could not store file in database");
  return { path: `/api/media/${row.id}` };
}

async function saveToLocal(input: {
  folder: string;
  buffer: Buffer;
  ext: string;
}) {
  const dir = path.join(process.cwd(), "public", "uploads", input.folder);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${input.ext}`;
  await writeFile(path.join(dir, filename), input.buffer);
  return { path: `/uploads/${input.folder}/${filename}` };
}

async function persistUpload(input: {
  folder: string;
  buffer: Buffer;
  mime: string;
  ext: string;
}) {
  if (hasSupabaseStorage()) {
    try {
      const remote = await saveToSupabase(input);
      if (remote) return remote;
    } catch (error) {
      console.error("[admin-upload] supabase:", error);
      // Fall through to DB / local.
    }
  }

  if (isHostedRuntime()) {
    try {
      return await saveToDatabase(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database storage failed";
      throw new Error(
        `${message}. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel for file uploads.`
      );
    }
  }

  return saveToLocal(input);
}

function imageExt(mime: string, forceExt?: string) {
  if (forceExt) return forceExt;
  if (mime === "image/png") return "png";
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export async function readMediaBlob(id: string) {
  await ensureMediaBlobsSchema();
  return queryOne<{ mime: string; bytes: Buffer }>(
    `select mime, bytes from public.media_blobs where id = $1`,
    [id]
  );
}

export async function saveUploadedImage(input: {
  folder: string;
  file: File;
  allowedTypes: Set<string>;
  forceExt?: string;
}) {
  if (!input.allowedTypes.has(input.file.type)) {
    return { error: `Unsupported file type: ${input.file.type || "unknown"}` } as const;
  }
  if (input.file.size > MAX_IMAGE_BYTES) {
    return { error: "Image must be 4MB or smaller" } as const;
  }

  try {
    await ensureMediaBlobsSchema();
    const bytes = Buffer.from(await input.file.arrayBuffer());
    const ext = imageExt(input.file.type, input.forceExt);
    const saved = await persistUpload({
      folder: input.folder,
      buffer: bytes,
      mime: input.file.type || "image/jpeg",
      ext
    });
    return saved;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save image"
    } as const;
  }
}

export async function saveUploadedMedia(input: {
  folder: string;
  file: File;
  allowedTypes: Set<string>;
}) {
  if (!input.allowedTypes.has(input.file.type)) {
    return { error: `Unsupported file type: ${input.file.type || "unknown"}` } as const;
  }
  const isVideo = input.file.type.startsWith("video/");
  const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (input.file.size > max) {
    return {
      error: isVideo ? "Video must be 40MB or smaller" : "Image must be 4MB or smaller"
    } as const;
  }

  try {
    await ensureMediaBlobsSchema();
    const bytes = Buffer.from(await input.file.arrayBuffer());
    const ext =
      input.file.type === "video/mp4" || input.file.type === "video/webm"
        ? input.file.type === "video/webm"
          ? "webm"
          : "mp4"
        : imageExt(input.file.type);
    const saved = await persistUpload({
      folder: input.folder,
      buffer: bytes,
      mime: input.file.type || "application/octet-stream",
      ext
    });
    return {
      path: saved.path,
      mediaType: isVideo ? ("video" as const) : ("image" as const)
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save media"
    } as const;
  }
}

export async function saveUploadedDocument(input: {
  folder: string;
  file: File;
  maxBytes?: number;
}) {
  const allowed = new Set([
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp"
  ]);
  if (!allowed.has(input.file.type)) {
    return {
      error: `Unsupported file type: ${input.file.type || "unknown"} (use PDF, JPG, PNG, or WebP)`
    } as const;
  }
  const max = input.maxBytes ?? 8 * 1024 * 1024;
  if (input.file.size > max) {
    return { error: "Document must be 8MB or smaller" } as const;
  }

  try {
    await ensureMediaBlobsSchema();
    const bytes = Buffer.from(await input.file.arrayBuffer());
    const ext =
      input.file.type === "application/pdf"
        ? "pdf"
        : input.file.type === "image/png"
          ? "png"
          : input.file.type === "image/webp"
            ? "webp"
            : "jpg";
    const saved = await persistUpload({
      folder: input.folder,
      buffer: bytes,
      mime: input.file.type || "application/octet-stream",
      ext
    });
    return saved;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save document"
    } as const;
  }
}
