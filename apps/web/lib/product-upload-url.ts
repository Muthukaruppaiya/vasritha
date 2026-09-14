import { getOpsPublicUrl, getStorefrontPublicUrl } from "./hosts";

export type ProductImageUploadKind = "website" | "internal";

/** Public URL for phone QR product photo upload page. */
export function buildProductUploadPageUrl(
  token: string,
  origin?: string,
  kind: ProductImageUploadKind = "website"
) {
  const base = (origin || getOpsPublicUrl() || getStorefrontPublicUrl()).replace(/\/$/, "");
  const params = new URLSearchParams();
  if (kind === "internal") params.set("kind", "internal");
  const query = params.toString();
  return `${base}/part/${token}${query ? `?${query}` : ""}`;
}

export function parseProductImageUploadKind(value: string | null | undefined): ProductImageUploadKind {
  return value === "internal" ? "internal" : "website";
}
