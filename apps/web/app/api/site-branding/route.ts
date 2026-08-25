import { cachedOk } from "../../../lib/auth/api";
import { queryOne } from "../../../lib/db/pool";

const GOLD_LOGO = "/vasritha-logo.png";

function customUpload(path: string | null | undefined) {
  if (path && path.startsWith("/uploads/")) return path;
  return null;
}

export async function GET() {
  const data = await queryOne<{
    site_name: string | null;
    logo_path: string | null;
    header_logo_path: string | null;
  }>(
    `select site_name, logo_path, header_logo_path
     from site_settings
     limit 1`
  );

  return cachedOk({
    siteName: data?.site_name || "Vasritha",
    logoPath: customUpload(data?.logo_path) || GOLD_LOGO,
    headerLogoPath: customUpload(data?.header_logo_path) || GOLD_LOGO
  });
}
