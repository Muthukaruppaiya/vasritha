import { getAdminToken } from "./admin-api";

/** Download a file from an authenticated admin API export endpoint. */
export async function downloadAdminExport(path: string, fallbackName: string) {
  const token = getAdminToken();
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error || "Export failed");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match?.[1] || fallbackName;
  a.click();
  URL.revokeObjectURL(url);
}
