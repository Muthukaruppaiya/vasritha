import { getOpsPublicUrl, getStorefrontPublicUrl } from "./hosts";

/** Public URL for phone QR product photo upload page. */
export function buildProductUploadPageUrl(token: string, origin?: string) {
  const base = (origin || getOpsPublicUrl() || getStorefrontPublicUrl()).replace(/\/$/, "");
  return `${base}/part/${token}`;
}
