import { queryOne } from "./pool";

export async function subcategoryBelongsToCategory(
  categoryId: string,
  subcategoryId: string | null | undefined
) {
  if (!subcategoryId) return true;
  const row = await queryOne<{ id: string }>(
    `select id from subcategories where id = $1 and category_id = $2`,
    [subcategoryId, categoryId]
  );
  return Boolean(row);
}

export function emptyToNull(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}
