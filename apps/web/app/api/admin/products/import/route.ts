import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";

type ImportRow = {
  name: string;
  slug: string;
  sku: string;
  barcode: string;
  category: string;
  colour: string;
  price: number;
  compare_at_price: number | null;
  stock: number;
  status: string;
  short_description: string;
  description: string;
  fast_selling: boolean;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const input = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length)) rows.push(row);
  return rows;
}

function parseSpreadsheetMl(xml: string): string[][] {
  const rows: string[][] = [];
  const rowMatches = xml.match(/<Row[\s\S]*?<\/Row>/gi) || [];
  for (const rowXml of rowMatches) {
    const cells = rowXml.match(/<Cell[\s\S]*?<\/Cell>|<Cell[^<]*\/>/gi) || [];
    const values = cells.map((cell) => {
      const data = cell.match(/<Data[^>]*>([\s\S]*?)<\/Data>/i);
      if (!data) return "";
      return data[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim();
    });
    if (values.some((value) => value.length)) rows.push(values);
  }
  return rows;
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/color/, "colour");
}

function mapRows(raw: string[][]): ImportRow[] {
  if (!raw.length) return [];
  const headers = raw[0].map(normalizeHeader);
  const index = (key: string) => headers.indexOf(key);

  const nameIdx = index("name");
  if (nameIdx < 0) throw new Error("Missing required column: name");

  const rows: ImportRow[] = [];
  for (const values of raw.slice(1)) {
    const name = values[nameIdx]?.trim();
    if (!name) continue;

    const get = (key: string, fallback = "") => {
      const i = index(key);
      return i >= 0 ? (values[i] || "").trim() : fallback;
    };

    const sku =
      get("sku") ||
      `VAS-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const slug = get("slug") || slugify(name);
    const price = Number(get("price", "0"));
    const compareRaw = get("compare_at_price") || get("compare_at");
    const stock = Number(get("stock") || get("stock_quantity") || "0");
    const statusRaw = (get("status", "draft") || "draft").toLowerCase();
    const status = ["draft", "active", "archived"].includes(statusRaw) ? statusRaw : "draft";
    const fast = get("fast_selling") || get("is_featured") || "no";

    rows.push({
      name,
      slug,
      sku,
      barcode: get("barcode") || sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16),
      category: get("category") || get("category_slug") || get("category_name"),
      colour: get("colour") || get("color"),
      price: Number.isFinite(price) ? price : 0,
      compare_at_price: compareRaw && Number.isFinite(Number(compareRaw)) ? Number(compareRaw) : null,
      stock: Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0,
      status,
      short_description: get("short_description"),
      description: get("description"),
      fast_selling: ["1", "true", "yes", "y"].includes(fast.toLowerCase())
    });
  }
  return rows;
}

async function upsertDefaultVariant(input: {
  productId: string;
  sku: string;
  barcode: string | null;
  price: number;
  stock: number;
}) {
  const existing = await queryOne<{ id: string }>(
    `select id from product_variants where product_id = $1 order by name asc limit 1`,
    [input.productId]
  );

  if (existing) {
    return queryOne(
      `update product_variants
       set sku = $2, barcode = $3, price = $4, stock_quantity = $5
       where id = $1
       returning *`,
      [existing.id, input.sku, input.barcode, input.price, input.stock]
    );
  }

  return queryOne(
    `insert into product_variants (product_id, name, sku, barcode, price, stock_quantity, attributes)
     values ($1, 'Default', $2, $3, $4, $5, '{}'::jsonb)
     returning *`,
    [input.productId, input.sku, input.barcode, input.price, input.stock]
  );
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "products:manage");
  if (error || !ctx) return error;

  const form = await request.formData().catch(() => null);
  if (!form) return fail("Upload a CSV or Excel (.xls) file");

  const file = form.get("file");
  if (!(file instanceof File)) return fail("Upload a CSV or Excel (.xls) file");

  const text = await file.text();
  const lower = file.name.toLowerCase();
  let rawRows: string[][];

  try {
    if (lower.endsWith(".xls") || text.includes("urn:schemas-microsoft-com:office:spreadsheet")) {
      rawRows = parseSpreadsheetMl(text);
    } else {
      rawRows = parseCsv(text);
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not parse file");
  }

  let rows: ImportRow[];
  try {
    rows = mapRows(rawRows);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Invalid import file");
  }

  if (!rows.length) return fail("No product rows found in the file");

  const categories = await query<{ id: string; slug: string; name: string }>(
    `select id, slug, name from categories`
  );
  const bySlug = new Map(categories.map((c) => [c.slug.toLowerCase(), c.id]));
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  const created: string[] = [];
  const updated: string[] = [];
  const failed: Array<{ name: string; error: string }> = [];

  for (const row of rows) {
    try {
      const categoryId =
        bySlug.get(row.category.toLowerCase()) || byName.get(row.category.toLowerCase());
      if (!categoryId) {
        failed.push({ name: row.name, error: `Unknown category: ${row.category || "(empty)"}` });
        continue;
      }

      const existing = await queryOne<{ id: string }>(
        `select id from products where slug = $1 or sku = $2 limit 1`,
        [row.slug, row.sku]
      );

      if (existing) {
        const data = await queryOne(
          `update products
           set name = $2, sku = $3, barcode = $4, category_id = $5, short_description = $6,
               color = $7, description = $8, price = $9, compare_at_price = $10,
               status = $11, stock_quantity = $12, is_featured = $13, updated_at = now()
           where id = $1
           returning *`,
          [
            existing.id,
            row.name,
            row.sku,
            row.barcode,
            categoryId,
            row.short_description,
            row.colour,
            row.description,
            row.price,
            row.compare_at_price,
            row.status,
            row.stock,
            row.fast_selling
          ]
        );
        await upsertDefaultVariant({
          productId: existing.id,
          sku: row.sku,
          barcode: row.barcode,
          price: row.price,
          stock: row.stock
        });
        await writeAuditLog({
          actorUserId: ctx.userId,
          action: "import_update",
          entityType: "products",
          entityId: existing.id,
          after: data
        });
        updated.push(row.name);
      } else {
        const data = await queryOne<{ id: string }>(
          `insert into products
             (name, slug, sku, barcode, category_id, short_description, color, description,
              price, compare_at_price, status, stock_quantity, is_featured)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           returning *`,
          [
            row.name,
            row.slug,
            row.sku,
            row.barcode,
            categoryId,
            row.short_description,
            row.colour,
            row.description,
            row.price,
            row.compare_at_price,
            row.status,
            row.stock,
            row.fast_selling
          ]
        );
        if (!data) {
          failed.push({ name: row.name, error: "Insert failed" });
          continue;
        }
        await upsertDefaultVariant({
          productId: data.id,
          sku: row.sku,
          barcode: row.barcode,
          price: row.price,
          stock: row.stock
        });
        await writeAuditLog({
          actorUserId: ctx.userId,
          action: "import_create",
          entityType: "products",
          entityId: data.id,
          after: data
        });
        created.push(row.name);
      }
    } catch (err) {
      failed.push({
        name: row.name,
        error: err instanceof Error ? err.message : "Import failed"
      });
    }
  }

  return ok({
    created: created.length,
    updated: updated.length,
    failed,
    createdNames: created,
    updatedNames: updated
  });
}
