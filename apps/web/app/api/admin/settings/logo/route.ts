import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { saveUploadedImage } from "../../../../../lib/admin-upload";
import { query, queryOne } from "../../../../../lib/db/pool";

const HEADER_LOGO = new Set(["image/svg+xml"]);
const GENERAL = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function ensureLogoColumns() {
  await query(`
    alter table public.site_settings
      add column if not exists logo_path text,
      add column if not exists header_logo_path text,
      add column if not exists favicon_path text
  `);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  try {
    await ensureLogoColumns();

    const form = await request.formData().catch(() => null);
    if (!form) return fail("Invalid form data");

    const kind = String(form.get("kind") || "");
    const file = form.get("file");
    if (!(file instanceof File)) return fail("file is required");
    if (kind !== "header" && kind !== "logo") {
      return fail("kind must be header or logo");
    }

    const existing = await queryOne<{ id: string }>(`select id from site_settings limit 1`);
    if (!existing) return fail("Settings row missing — open Settings once to create it", 404);

    const saved = await saveUploadedImage({
      folder: kind === "header" ? "branding/header" : "branding/logo",
      file,
      allowedTypes: kind === "header" ? HEADER_LOGO : GENERAL,
      forceExt: kind === "header" ? "svg" : undefined
    });
    if ("error" in saved) {
      return fail(
        kind === "header" && /Unsupported file type/i.test(saved.error)
          ? "Header logo must be an SVG file"
          : saved.error,
        400
      );
    }

    const column = kind === "header" ? "header_logo_path" : "logo_path";
    const before = await queryOne(`select * from site_settings where id = $1`, [existing.id]);
    const data = await queryOne(
      `update site_settings set ${column} = $2, updated_at = now() where id = $1 returning *`,
      [existing.id, saved.path]
    );

    await writeAuditLog({
      actorUserId: ctx.userId,
      action: "update",
      entityType: "site_settings",
      entityId: existing.id,
      before,
      after: data
    });

    return ok(data);
  } catch (err) {
    console.error("[settings/logo]", err);
    return fail(err instanceof Error ? err.message : "Could not upload logo", 500);
  }
}
