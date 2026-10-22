import { cachedOk } from "../../../lib/auth/api";
import { queryOne } from "../../../lib/db/pool";

const GOLD_LOGO = "/vasritha-logo.png";

function customUpload(path: string | null | undefined) {
  if (path && path.startsWith("/uploads/")) return path;
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
  const data = await queryOne<{
    site_name: string | null;
    logo_path: string | null;
    header_logo_path: string | null;
    support_phone: string | null;
    support_email: string | null;
    whatsapp_number: string | null;
    social_links: Record<string, unknown> | null;
  }>(
    `select site_name, logo_path, header_logo_path, support_phone, support_email,
            whatsapp_number, social_links
     from site_settings
     limit 1`
  );

  const links = data?.social_links || {};
  const whatsapp = String(data?.whatsapp_number || "").replace(/\D/g, "");

  return cachedOk({
    siteName: data?.site_name || "Vasritha",
    logoPath: customUpload(data?.logo_path) || GOLD_LOGO,
    headerLogoPath: customUpload(data?.header_logo_path) || GOLD_LOGO,
    supportPhone: data?.support_phone?.trim() || null,
    supportEmail: data?.support_email?.trim() || null,
    facebookUrl: socialUrl(links, "facebook", "facebookUrl", "fb"),
    instagramUrl: socialUrl(links, "instagram", "instagramUrl", "ig"),
    whatsappUrl: whatsapp ? `https://wa.me/${whatsapp}` : ""
  });
}
