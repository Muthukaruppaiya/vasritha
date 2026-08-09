import { cachedOk } from "../../../lib/auth/api";
import { queryOne } from "../../../lib/db/pool";

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
    logoPath: data?.logo_path || "/vasritha-logo.svg",
    headerLogoPath: data?.header_logo_path || data?.logo_path || "/vasritha-logo-header.png"
  });
}
