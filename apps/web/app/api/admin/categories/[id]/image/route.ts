import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../../lib/auth/api";
import { saveUploadedImage } from "../../../../../../lib/admin-upload";
import { queryOne } from "../../../../../../lib/db/pool";

type Params = { params: Promise<{ id: string }> };

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "categories:manage");
  if (error || !ctx) return error;

  const { id } = await params;
  const category = await queryOne<{ id: string }>(`select id from categories where id = $1`, [id]);
  if (!category) return fail("Category not found", 404);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("file is required");

  const saved = await saveUploadedImage({
    folder: `categories/${id}`,
    file,
    allowedTypes: ALLOWED
  });
  if ("error" in saved) return fail(saved.error, 400);

  const before = await queryOne(`select * from categories where id = $1`, [id]);
  const data = await queryOne(
    `update categories set image_path = $2 where id = $1 returning *`,
    [id, saved.path]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "categories",
    entityId: id,
    before,
    after: data
  });

  return ok(data);
}
