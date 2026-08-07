import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { fail, ok, requireAuth, requirePermission, writeAuditLog } from "../../../lib/auth/api";
import { query, queryOne } from "../../../lib/db/pool";
import { sendMail } from "../../../lib/mail";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function saveReviewImage(dataUrl: string) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return { error: "Invalid image data" as const };
  const mime = match[1];
  if (!ALLOWED.has(mime)) return { error: "Only JPEG, PNG, WebP or GIF images are allowed" as const };
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) return { error: "Image must be under 4MB" as const };

  const ext =
    mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
  const dir = path.join(process.cwd(), "public", "uploads", "reviews");
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);
  return { path: `/uploads/reviews/${filename}` as const };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const admin = searchParams.get("admin") === "1";

  if (admin) {
    const { error } = await requirePermission(request, "cms:manage");
    if (error) return error;

    const status = searchParams.get("status") || "pending";
    const data = await query(
      `select
         r.id, r.product_id, r.customer_id, r.customer_name, r.reviewer_email,
         r.rating, r.title, r.body, r.image_path, r.is_featured, r.is_approved, r.created_at,
         p.name as product_name, p.slug as product_slug
       from reviews r
       left join products p on p.id = r.product_id
       where (
         $1::text = 'all'
         or ($1::text = 'pending' and r.is_approved = false)
         or ($1::text = 'approved' and r.is_approved = true)
       )
       order by r.created_at desc
       limit 200`,
      [status]
    );
    return ok(data);
  }

  const data = await query(
    `select id, product_id, customer_name, rating, title, body, image_path, is_featured, created_at
     from reviews
     where is_approved = true
       and ($1::uuid is null or product_id = $1)
     order by created_at desc
     limit 50`,
    [productId]
  );
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requireAuth(request);
  if (error || !ctx) return error;

  const contentType = request.headers.get("content-type") || "";
  let productId: string | null = null;
  let customerName = "";
  let rating = 0;
  let title: string | null = null;
  let bodyText = "";
  let imagePath: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return fail("Invalid form data");
    productId = String(form.get("productId") || "") || null;
    customerName = String(form.get("customerName") || "").trim();
    rating = Number(form.get("rating"));
    title = String(form.get("title") || "").trim() || null;
    bodyText = String(form.get("body") || "").trim();

    const file = form.get("image");
    if (file instanceof File && file.size > 0) {
      if (!ALLOWED.has(file.type)) return fail("Only JPEG, PNG, WebP or GIF images are allowed");
      if (file.size > MAX_BYTES) return fail("Image must be under 4MB");
      const dir = path.join(process.cwd(), "public", "uploads", "reviews");
      await mkdir(dir, { recursive: true });
      const ext =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : file.type === "image/gif"
              ? "gif"
              : "jpg";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
      imagePath = `/uploads/reviews/${filename}`;
    }
  } else {
    const body = (await request.json().catch(() => null)) as {
      productId?: string;
      customerName?: string;
      rating?: number;
      title?: string;
      body?: string;
      imageDataUrl?: string;
    } | null;

    if (!body) return fail("Invalid body");
    productId = body.productId ?? null;
    customerName = (body.customerName || "").trim();
    rating = Number(body.rating);
    title = (body.title || "").trim() || null;
    bodyText = (body.body || "").trim();

    if (body.imageDataUrl) {
      const saved = await saveReviewImage(body.imageDataUrl);
      if ("error" in saved) return fail(saved.error, 400);
      imagePath = saved.path;
    }
  }

  if (!customerName || !rating || !bodyText) {
    return fail("customerName, rating and body are required");
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return fail("rating must be between 1 and 5");
  }
  if (!productId) return fail("productId is required");

  const product = await queryOne<{ id: string; name: string; slug: string }>(
    `select id, name, slug from products where id = $1`,
    [productId]
  );
  if (!product) return fail("Product not found", 404);

  const customer = await queryOne<{ id: string }>(`select id from customers where id = $1`, [
    ctx.userId
  ]);
  if (!customer) return fail("Customer profile required. Please login as a shopper.", 403);

  const data = await queryOne(
    `insert into reviews
       (product_id, customer_id, customer_name, reviewer_email, rating, title, body, image_path, is_approved, is_featured)
     values ($1, $2, $3, $4, $5, $6, $7, $8, false, false)
     returning *`,
    [
      productId,
      ctx.userId,
      customerName,
      ctx.email,
      Math.round(rating),
      title,
      bodyText,
      imagePath
    ]
  );

  const settings = await queryOne<{ support_email: string | null; site_name: string | null }>(
    `select support_email, site_name from site_settings limit 1`
  );
  const adminEmail = settings?.support_email || process.env.ADMIN_NOTIFY_EMAIL || null;
  if (adminEmail) {
    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    await sendMail({
      to: adminEmail,
      subject: `[Vasritha] New review pending — ${product.name}`,
      text: [
        `A new product review is waiting for approval.`,
       ``,
        `Product: ${product.name}`,
        `Reviewer: ${customerName}${ctx.email ? ` <${ctx.email}>` : ""}`,
        `Rating: ${Math.round(rating)} / 5`,
        title ? `Title: ${title}` : "",
        ``,
        bodyText,
        ``,
        `Moderate: ${site}/admin/reviews`
      ]
        .filter(Boolean)
        .join("\n")
    });
  }

  return ok(data, 201);
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "cms:manage");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    reviewId?: string;
    is_approved?: boolean;
    is_featured?: boolean;
  } | null;

  if (!body?.reviewId) return fail("reviewId is required");

  const existing = await queryOne(`select * from reviews where id = $1`, [body.reviewId]);
  if (!existing) return fail("Review not found", 404);

  const data = await queryOne(
    `update reviews
     set is_approved = coalesce($2, is_approved),
         is_featured = coalesce($3, is_featured)
     where id = $1
     returning *`,
    [body.reviewId, body.is_approved ?? null, body.is_featured ?? null]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "moderate",
    entityType: "reviews",
    entityId: body.reviewId,
    before: existing,
    after: data
  });
  return ok(data);
}
