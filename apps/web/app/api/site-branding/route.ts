import { ok } from "../../../lib/auth/api";
import { queryOne } from "../../../lib/db/pool";
import { ensureCompanySettingsSchema } from "../../../lib/company-settings";

const GOLD_LOGO = "/vasritha-logo.png";

function customUpload(path: string | null | undefined) {
  const raw = String(path || "").trim();
  if (!raw) return null;
  if (raw.startsWith("/uploads/") || raw.startsWith("/api/media/") || /^https?:\/\//i.test(raw)) {
    return raw;
  }
  return null;
}

function httpUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function socialUrl(
  links: Record<string, unknown> | null | undefined,
  ...keys: string[]
) {
  if (!links) return "";
  for (const key of keys) {
    const url = httpUrl(links[key]);
    if (url) return url;
  }
  return "";
}

export async function GET() {
  await ensureCompanySettingsSchema().catch(() => undefined);
  type BrandingRow = {
    site_name: string | null;
    logo_path: string | null;
    header_logo_path: string | null;
    support_phone: string | null;
    support_email: string | null;
    whatsapp_number: string | null;
    social_links: Record<string, unknown> | null;
    storefront_coming_soon?: boolean | null;
    storefront_coming_soon_title?: string | null;
    storefront_coming_soon_message?: string | null;
    storefront_coming_soon_media_path?: string | null;
  };
  const data =
    (await queryOne<BrandingRow>(
      `select site_name, logo_path, header_logo_path, support_phone, support_email,
              whatsapp_number, social_links, storefront_coming_soon,
              storefront_coming_soon_title, storefront_coming_soon_message,
              storefront_coming_soon_media_path
       from site_settings
       limit 1`
    ).catch(() =>
      queryOne<BrandingRow>(
        `select site_name, logo_path, header_logo_path, support_phone, support_email,
                whatsapp_number, social_links
         from site_settings
         limit 1`
      )
    ));

  const links = data?.social_links || {};
  const whatsapp = String(data?.whatsapp_number || "").replace(/\D/g, "");

  return ok(
    {
      siteName: data?.site_name || "Vasritha",
      logoPath: customUpload(data?.logo_path) || GOLD_LOGO,
      headerLogoPath: customUpload(data?.header_logo_path) || GOLD_LOGO,
      supportPhone: data?.support_phone?.trim() || null,
      supportEmail: data?.support_email?.trim() || null,
      facebookUrl: socialUrl(links, "facebook", "facebookUrl", "fb"),
      instagramUrl: socialUrl(links, "instagram", "instagramUrl", "ig"),
      whatsappUrl: whatsapp ? `https://wa.me/${whatsapp}` : "",
      comingSoon: Boolean(data?.storefront_coming_soon),
      comingSoonTitle: data?.storefront_coming_soon_title?.trim() || "Stocking up",
      comingSoonMessage:
        data?.storefront_coming_soon_message?.trim() ||
        "We're filling the racks. Vasritha will be ready soon.",
      comingSoonMediaUrl: customUpload(data?.storefront_coming_soon_media_path)
    },
    200,
    { "Cache-Control": "public, max-age=5, stale-while-revalidate=15" }
  );
}
