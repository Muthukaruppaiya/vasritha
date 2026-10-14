import ExcelJS from "exceljs";
import { query, queryOne } from "./db/pool";
import { subcategoryBelongsToCategory } from "./db/taxonomy";
import { ensureColourName, ensureColoursSchema, listProductColours } from "./colours";
import { normalizeHsn, resolveSaleGstRate } from "./gst";
import { ensureBrandsSchema, listBrands, resolveBrandId } from "./brands";
import {
  createUnitsAndSync,
  recordPriceHistory
} from "./product-units";
import {
  PRODUCT_STATUSES,
  canApproveProducts,
  normalizeProductStatus,
  type ProductStatus
} from "./product-status";
import type { AppRole } from "./auth/rbac";
import { writeAuditLog } from "./auth/api";

/** Columns shown in the Excel template — matches Product Master form. */
export const PRODUCT_IMPORT_COLUMNS = [
  { key: "name", label: "name", required: true, hint: "Product name (required)" },
  { key: "short_name", label: "short_name", required: false, hint: "Short name for cards" },
  { key: "slug", label: "slug", required: false, hint: "URL slug (auto from name if blank)" },
  { key: "sku", label: "sku", required: false, hint: "Unique SKU (auto if blank)" },
  { key: "sku_prefix", label: "sku_prefix", required: false, hint: "VAS | PADH | VRSH" },
  { key: "tag", label: "tag", required: false, hint: "Piece tag / family tag" },
  { key: "barcode", label: "barcode", required: false, hint: "Family barcode (auto from SKU)" },
  { key: "category", label: "category", required: true, hint: "Category name or slug" },
  { key: "subcategory", label: "subcategory", required: false, hint: "Subcategory name" },
  { key: "colour", label: "colour", required: false, hint: "Required unless multicolour" },
  { key: "is_multicolour", label: "is_multicolour", required: false, hint: "yes / no" },
  { key: "price", label: "price", required: true, hint: "Selling price (GST inclusive)" },
  { key: "compare_at_price", label: "compare_at_price", required: false, hint: "MRP / compare-at" },
  { key: "hsn_code", label: "hsn_code", required: false, hint: "4–8 digit HSN" },
  { key: "gst_rate", label: "gst_rate", required: false, hint: "0 | 3 | 5 | 9 | 12 | 18" },
  { key: "label_size", label: "label_size", required: false, hint: "dress | accessory" },
  { key: "status", label: "status", required: false, hint: "draft | pending_approval | active | archived" },
  { key: "opening_stock", label: "opening_stock", required: false, hint: "Pieces on create only (not multicolour)" },
  { key: "short_description", label: "short_description", required: false, hint: "Max ~220 chars" },
  { key: "description", label: "description", required: false, hint: "Full description" },
  { key: "is_featured", label: "is_featured", required: false, hint: "yes / no — Fast selling" },
  { key: "restock_expected", label: "restock_expected", required: false, hint: "yes / no — Coming soon" },
  { key: "brand", label: "brand", required: false, hint: "Brand name (optional)" },
  { key: "parent_sku", label: "parent_sku", required: false, hint: "Parent product SKU (child designs)" }
] as const;

export type ProductImportColumnKey = (typeof PRODUCT_IMPORT_COLUMNS)[number]["key"];

export type ProductImportRow = {
  name: string;
  short_name: string;
  slug: string;
  sku: string;
  sku_prefix: string;
  tag: string;
  barcode: string;
  category: string;
  subcategory: string;
  colour: string;
  is_multicolour: boolean;
  price: number;
  compare_at_price: number | null;
  hsn_code: string | null;
  gst_rate: number | null;
  label_size: "dress" | "accessory";
  status: string;
  opening_stock: number;
  short_description: string;
  description: string;
  is_featured: boolean;
  restock_expected: boolean;
  brand: string;
  parent_sku: string;
  rowNumber: number;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function truthy(value: string) {
  return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/color/, "colour")
    .replace(/^stock$/, "opening_stock")
    .replace(/^stock_quantity$/, "opening_stock")
    .replace(/^fast_selling$/, "is_featured")
    .replace(/^compare_at$/, "compare_at_price")
    .replace(/^category_name$/, "category")
    .replace(/^category_slug$/, "category")
    .replace(/^subcategory_name$/, "subcategory");
}

export function parseCsvText(text: string): string[][] {
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
      if (row.some((v) => v.length)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((v) => v.length)) rows.push(row);
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
    if (values.some((v) => v.length)) rows.push(values);
  }
  return rows;
}

export async function parseWorkbookBuffer(buffer: ArrayBuffer | Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  const bytes = Uint8Array.from(
    buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer
  );
  // exceljs 4 load typing conflicts with outdated @types/exceljs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (workbook.xlsx as any).load(bytes);
  const sheet =
    workbook.getWorksheet("Products") ||
    workbook.worksheets.find((ws) => ws.name.toLowerCase() === "products") ||
    workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    const count = Math.max(row.cellCount, PRODUCT_IMPORT_COLUMNS.length);
    for (let c = 1; c <= count; c += 1) {
      const cell = row.getCell(c);
      const raw = cell.value;
      if (raw == null) {
        values.push("");
      } else if (typeof raw === "object" && "text" in (raw as object)) {
        values.push(String((raw as { text: string }).text || "").trim());
      } else if (typeof raw === "object" && "result" in (raw as object)) {
        values.push(String((raw as { result: unknown }).result ?? "").trim());
      } else {
        values.push(String(raw).trim());
      }
    }
    if (values.some((v) => v.length)) rows.push(values);
  });
  return rows;
}

export function mapImportRows(raw: string[][]): ProductImportRow[] {
  if (!raw.length) return [];
  const headers = raw[0].map(normalizeHeader);
  const index = (key: string) => headers.indexOf(key);
  const nameIdx = index("name");
  if (nameIdx < 0) throw new Error("Missing required column: name");

  const rows: ProductImportRow[] = [];
  raw.slice(1).forEach((values, idx) => {
    const name = (values[nameIdx] || "").trim();
    if (!name) return;

    const get = (...keys: string[]) => {
      for (const key of keys) {
        const i = index(key);
        if (i >= 0 && values[i] != null && String(values[i]).trim()) {
          return String(values[i]).trim();
        }
      }
      return "";
    };

    const skuPrefix =
      (get("sku_prefix") || "VAS").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8) || "VAS";
    const sku =
      get("sku").toUpperCase() ||
      `${skuPrefix}-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const price = Number(get("price") || "0");
    const compareRaw = get("compare_at_price");
    const stock = Number(get("opening_stock") || "0");
    const labelRaw = (get("label_size") || "dress").toLowerCase();
    const gstRaw = get("gst_rate");

    rows.push({
      name,
      short_name: get("short_name"),
      slug: get("slug") || slugify(name),
      sku,
      sku_prefix: skuPrefix,
      tag: (get("tag") || sku).toUpperCase(),
      barcode:
        get("barcode") ||
        sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16),
      category: get("category"),
      subcategory: get("subcategory"),
      colour: get("colour"),
      is_multicolour: truthy(get("is_multicolour")),
      price: Number.isFinite(price) ? price : 0,
      compare_at_price:
        compareRaw && Number.isFinite(Number(compareRaw)) ? Number(compareRaw) : null,
      hsn_code: normalizeHsn(get("hsn_code")),
      gst_rate: gstRaw && Number.isFinite(Number(gstRaw)) ? Number(gstRaw) : null,
      label_size: labelRaw === "accessory" ? "accessory" : "dress",
      status: get("status") || "draft",
      opening_stock: Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0,
      short_description: get("short_description"),
      description: get("description"),
      is_featured: truthy(get("is_featured")),
      restock_expected: truthy(get("restock_expected")),
      brand: get("brand"),
      parent_sku: get("parent_sku").toUpperCase(),
      rowNumber: idx + 2
    });
  });
  return rows;
}

export async function parseImportFile(file: File): Promise<string[][]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
    return parseWorkbookBuffer(await file.arrayBuffer());
  }
  const text = await file.text();
  if (lower.endsWith(".xls") || text.includes("urn:schemas-microsoft-com:office:spreadsheet")) {
    return parseSpreadsheetMl(text);
  }
  return parseCsvText(text);
}

async function upsertDefaultVariant(input: {
  productId: string;
  sku: string;
  barcode: string | null;
  price: number;
}) {
  const existing = await queryOne<{ id: string }>(
    `select id from product_variants where product_id = $1 order by name asc limit 1`,
    [input.productId]
  );
  if (existing) {
    return queryOne<{ id: string }>(
      `update product_variants
       set sku = $2, barcode = $3, price = $4
       where id = $1
       returning *`,
      [existing.id, input.sku, input.barcode, input.price]
    );
  }
  return queryOne<{ id: string }>(
    `insert into product_variants (product_id, name, sku, barcode, price, stock_quantity, attributes)
     values ($1, 'Default', $2, $3, $4, 0, '{}'::jsonb)
     returning *`,
    [input.productId, input.sku, input.barcode, input.price]
  );
}

export async function buildProductImportTemplate(): Promise<Buffer> {
  await ensureColoursSchema().catch(() => undefined);
  await ensureBrandsSchema().catch(() => undefined);

  const [categories, subcategories, colourRows, brandRows] = await Promise.all([
    query<{ id: string; name: string; slug: string }>(
      `select id, name, slug from categories order by name asc`
    ),
    query<{ id: string; name: string; category_id: string; category_name: string }>(
      `select sc.id, sc.name, sc.category_id, c.name as category_name
       from subcategories sc
       join categories c on c.id = sc.category_id
       order by c.name asc, sc.name asc`
    ),
    listProductColours({ activeOnly: true }).catch(() => [] as Array<{ name: string }>),
    listBrands({ activeOnly: true }).catch(() => [] as Array<{ name: string }>)
  ]);
  const colours = colourRows.map((c) => ({ name: c.name }));
  const brands = brandRows.map((b) => ({ name: b.name }));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vasritha";
  workbook.created = new Date();

  const instructions = workbook.addWorksheet("Instructions");
  instructions.getColumn(1).width = 92;
  const tips = [
    "Vasritha Product Master — bulk import template",
    "",
    "1. Fill rows on the Products sheet. Do not rename column headers.",
    "2. Use dropdowns for category, subcategory, sku_prefix, label_size, status, gst_rate, yes/no fields.",
    "3. Required: name, category, price. Colour is required unless is_multicolour = yes.",
    "4. opening_stock creates unique piece barcodes on NEW products only (not multicolour).",
    "5. Existing products (matched by slug or sku) are updated for catalogue fields; stock is not changed — use GRN.",
    "6. Lookups sheet lists valid categories, subcategories, colours, and brands.",
    "7. Save as .xlsx and upload from Product Master → Import bulk data.",
    "",
    `Generated: ${new Date().toISOString().slice(0, 19)}`
  ];
  tips.forEach((line, i) => {
    instructions.getCell(i + 1, 1).value = line;
    if (i === 0) instructions.getCell(i + 1, 1).font = { bold: true, size: 14 };
  });

  const lookups = workbook.addWorksheet("Lookups");
  lookups.getCell(1, 1).value = "Categories";
  lookups.getCell(1, 2).value = "Category|Subcategory";
  lookups.getCell(1, 3).value = "Colours";
  lookups.getCell(1, 4).value = "Brands";
  lookups.getCell(1, 5).value = "sku_prefix";
  lookups.getCell(1, 6).value = "label_size";
  lookups.getCell(1, 7).value = "status";
  lookups.getCell(1, 8).value = "gst_rate";
  lookups.getCell(1, 9).value = "yes_no";
  lookups.getRow(1).font = { bold: true };

  categories.forEach((c, i) => {
    lookups.getCell(i + 2, 1).value = c.name;
  });
  subcategories.forEach((s, i) => {
    lookups.getCell(i + 2, 2).value = `${s.category_name} | ${s.name}`;
  });
  colours.forEach((c, i) => {
    lookups.getCell(i + 2, 3).value = c.name;
  });
  brands.forEach((b, i) => {
    lookups.getCell(i + 2, 4).value = b.name;
  });
  ["VAS", "PADH", "VRSH"].forEach((v, i) => {
    lookups.getCell(i + 2, 5).value = v;
  });
  ["dress", "accessory"].forEach((v, i) => {
    lookups.getCell(i + 2, 6).value = v;
  });
  [...PRODUCT_STATUSES].forEach((v, i) => {
    lookups.getCell(i + 2, 7).value = v;
  });
  ["0", "3", "5", "9", "12", "18"].forEach((v, i) => {
    lookups.getCell(i + 2, 8).value = v;
  });
  ["yes", "no"].forEach((v, i) => {
    lookups.getCell(i + 2, 9).value = v;
  });

  const catCount = Math.max(categories.length, 1);
  const subCount = Math.max(subcategories.length, 1);
  const colourCount = Math.max(colours.length, 1);
  const brandCount = Math.max(brands.length, 1);

  const products = workbook.addWorksheet("Products", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  PRODUCT_IMPORT_COLUMNS.forEach((col, i) => {
    const cell = products.getCell(1, i + 1);
    cell.value = col.label;
    cell.font = { bold: true, color: { argb: col.required ? "FF8B1E1E" : "FF2B1A10" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: col.required ? "FFFFE8E0" : "FFF5EDE4" }
    };
    cell.note = col.hint;
    products.getColumn(i + 1).width = Math.min(28, Math.max(14, col.label.length + 4));
  });

  // Sample row
  const sampleCat = categories[0]?.name || "Sarees";
  const sampleSub =
    subcategories.find((s) => s.category_name === sampleCat)?.name ||
    subcategories[0]?.name ||
    "";
  const sample: Record<string, string | number> = {
    name: "Sample Silk Saree",
    short_name: "Sample Silk",
    slug: "sample-silk-saree",
    sku: "",
    sku_prefix: "VAS",
    tag: "",
    barcode: "",
    category: sampleCat,
    subcategory: sampleSub,
    colour: colours[0]?.name || "Maroon",
    is_multicolour: "no",
    price: 8990,
    compare_at_price: 9990,
    hsn_code: "5407",
    gst_rate: 5,
    label_size: "dress",
    status: "draft",
    opening_stock: 2,
    short_description: "Sample row — delete or replace",
    description: "",
    is_featured: "no",
    restock_expected: "no",
    brand: brands[0]?.name || "",
    parent_sku: ""
  };
  PRODUCT_IMPORT_COLUMNS.forEach((col, i) => {
    products.getCell(2, i + 1).value = sample[col.key] ?? "";
  });

  const dataEnd = 500;
  const colIndex = (key: string) =>
    PRODUCT_IMPORT_COLUMNS.findIndex((c) => c.key === key) + 1;

  const addList = (colKey: string, formula: string) => {
    const col = colIndex(colKey);
    if (col < 1) return;
    for (let r = 2; r <= dataEnd; r += 1) {
      products.getCell(r, col).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorTitle: "Invalid value",
        error: "Pick a value from the dropdown list."
      };
    }
  };

  addList("category", `Lookups!$A$2:$A$${catCount + 1}`);
  addList("subcategory", `Lookups!$B$2:$B$${subCount + 1}`);
  addList("colour", `Lookups!$C$2:$C$${colourCount + 1}`);
  addList("brand", `Lookups!$D$2:$D$${brandCount + 1}`);
  addList("sku_prefix", "Lookups!$E$2:$E$4");
  addList("label_size", "Lookups!$F$2:$F$3");
  addList("status", `Lookups!$G$2:$G$${PRODUCT_STATUSES.length + 1}`);
  addList("gst_rate", "Lookups!$H$2:$H$7");
  addList("is_multicolour", "Lookups!$I$2:$I$3");
  addList("is_featured", "Lookups!$I$2:$I$3");
  addList("restock_expected", "Lookups!$I$2:$I$3");

  // Subcategory column stores "Category | Subcategory" in dropdown for clarity;
  // import accepts either "Category | Name" or plain name.
  products.getCell(1, colIndex("subcategory")).note =
    "Pick from list (Category | Subcategory) or type subcategory name only";

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export type ImportRunResult = {
  created: number;
  updated: number;
  failed: Array<{ name: string; row?: number; error: string }>;
  createdNames: string[];
  updatedNames: string[];
};

export async function runProductImport(input: {
  rows: ProductImportRow[];
  actorUserId: string;
  roles: AppRole[];
}): Promise<ImportRunResult> {
  const canApprove = canApproveProducts(input.roles || []);
  const categories = await query<{ id: string; slug: string; name: string }>(
    `select id, slug, name from categories`
  );
  const subcategories = await query<{
    id: string;
    name: string;
    category_id: string;
  }>(`select id, name, category_id from subcategories`);

  const byCatSlug = new Map(categories.map((c) => [c.slug.toLowerCase(), c]));
  const byCatName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

  const created: string[] = [];
  const updated: string[] = [];
  const failed: Array<{ name: string; row?: number; error: string }> = [];

  for (const row of input.rows) {
    try {
      if (!row.name.trim()) {
        failed.push({ name: "(blank)", row: row.rowNumber, error: "Name is required" });
        continue;
      }
      if (!Number.isFinite(row.price) || row.price < 0) {
        failed.push({ name: row.name, row: row.rowNumber, error: "Valid price is required" });
        continue;
      }

      const category =
        byCatSlug.get(row.category.toLowerCase()) || byCatName.get(row.category.toLowerCase());
      if (!category) {
        failed.push({
          name: row.name,
          row: row.rowNumber,
          error: `Unknown category: ${row.category || "(empty)"}`
        });
        continue;
      }

      let subcategoryId: string | null = null;
      const subRaw = row.subcategory.trim();
      if (subRaw) {
        const plain = subRaw.includes("|") ? subRaw.split("|").pop()!.trim() : subRaw;
        const matches = subcategories.filter(
          (s) =>
            s.category_id === category.id && s.name.toLowerCase() === plain.toLowerCase()
        );
        if (!matches.length) {
          failed.push({
            name: row.name,
            row: row.rowNumber,
            error: `Unknown subcategory for ${category.name}: ${plain}`
          });
          continue;
        }
        subcategoryId = matches[0]!.id;
      }
      if (!(await subcategoryBelongsToCategory(category.id, subcategoryId))) {
        failed.push({
          name: row.name,
          row: row.rowNumber,
          error: "Subcategory must belong to the selected category"
        });
        continue;
      }

      const isMulticolour = row.is_multicolour;
      const productColor = isMulticolour ? "" : row.colour.trim();
      if (!isMulticolour && !productColor) {
        failed.push({
          name: row.name,
          row: row.rowNumber,
          error: "Colour is required unless is_multicolour is yes"
        });
        continue;
      }
      if (productColor) await ensureColourName(productColor);

      const status = normalizeProductStatus(row.status, {
        canApprove,
        fallback: canApprove ? "draft" : "pending_approval"
      }) as ProductStatus;

      const gstRate = resolveSaleGstRate({
        hsnCode: row.hsn_code,
        saleValuePerPiece: row.price,
        fallbackRate: row.gst_rate
      });

      let brandId: string | null = null;
      if (row.brand.trim()) {
        const brand = await queryOne<{ id: string }>(
          `select id from brands where lower(name) = lower($1) limit 1`,
          [row.brand.trim()]
        );
        brandId = brand?.id || null;
      } else {
        brandId = await resolveBrandId(null).catch(() => null);
      }

      let parentProductId: string | null = null;
      if (row.parent_sku.trim()) {
        const parent = await queryOne<{ id: string; parent_product_id: string | null }>(
          `select id, parent_product_id from products where upper(sku) = $1 limit 1`,
          [row.parent_sku.trim()]
        );
        if (!parent) {
          failed.push({
            name: row.name,
            row: row.rowNumber,
            error: `Parent SKU not found: ${row.parent_sku}`
          });
          continue;
        }
        if (parent.parent_product_id) {
          failed.push({
            name: row.name,
            row: row.rowNumber,
            error: "Parent must be a top-level product"
          });
          continue;
        }
        parentProductId = parent.id;
      }

      const existing = await queryOne<{ id: string }>(
        `select id from products where slug = $1 or sku = $2 limit 1`,
        [row.slug, row.sku]
      );

      const familyBarcode = row.barcode.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16);
      const openingStock = isMulticolour ? 0 : row.opening_stock;

      if (existing) {
        const data = await queryOne(
          `update products
           set name = $2, slug = $3, sku = $4, barcode = $5, tag = $6, sku_prefix = $7,
               label_size = $8, category_id = $9, subcategory_id = $10,
               short_name = $11, short_description = $12, color = $13, is_multicolour = $14,
               description = $15, price = $16, compare_at_price = $17, hsn_code = $18,
               gst_rate = $19, status = $20, is_featured = $21, restock_expected = $22,
               parent_product_id = $23, brand_id = coalesce($24, brand_id), updated_at = now()
           where id = $1
           returning *`,
          [
            existing.id,
            row.name,
            row.slug,
            row.sku,
            familyBarcode,
            row.tag.toUpperCase(),
            row.sku_prefix,
            row.label_size,
            category.id,
            subcategoryId,
            row.short_name,
            row.short_description,
            productColor,
            isMulticolour,
            row.description,
            row.price,
            row.compare_at_price,
            row.hsn_code,
            gstRate,
            status,
            row.is_featured,
            row.restock_expected,
            parentProductId,
            brandId
          ]
        );
        await upsertDefaultVariant({
          productId: existing.id,
          sku: row.sku,
          barcode: familyBarcode,
          price: row.price
        });
        await writeAuditLog({
          actorUserId: input.actorUserId,
          action: "import_update",
          entityType: "products",
          entityId: existing.id,
          after: data
        });
        updated.push(row.name);
      } else {
        const data = await queryOne<{ id: string }>(
          `insert into products
             (name, slug, sku, barcode, tag, sku_prefix, label_size, category_id, subcategory_id,
              short_name, short_description, color, is_multicolour, description,
              price, compare_at_price, hsn_code, gst_rate, status, stock_quantity, is_featured,
              parent_product_id, brand_id, restock_expected)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,0,$20,$21,$22,$23)
           returning *`,
          [
            row.name,
            row.slug,
            row.sku,
            familyBarcode,
            row.tag.toUpperCase(),
            row.sku_prefix,
            row.label_size,
            category.id,
            subcategoryId,
            row.short_name,
            row.short_description,
            productColor,
            isMulticolour,
            row.description,
            row.price,
            row.compare_at_price,
            row.hsn_code,
            gstRate,
            status,
            row.is_featured,
            parentProductId,
            brandId,
            row.restock_expected
          ]
        );
        if (!data) {
          failed.push({ name: row.name, row: row.rowNumber, error: "Insert failed" });
          continue;
        }
        const variant = await upsertDefaultVariant({
          productId: data.id,
          sku: row.sku,
          barcode: familyBarcode,
          price: row.price
        });
        if (variant?.id && openingStock > 0) {
          await createUnitsAndSync({
            productId: data.id,
            variantId: variant.id,
            tag: row.tag.toUpperCase(),
            sku: row.sku,
            count: openingStock,
            color: productColor || null
          });
        }
        await recordPriceHistory(data.id, row.price);
        await writeAuditLog({
          actorUserId: input.actorUserId,
          action: "import_create",
          entityType: "products",
          entityId: data.id,
          after: { ...data, opening_stock: openingStock }
        });
        created.push(row.name);
      }
    } catch (err) {
      failed.push({
        name: row.name,
        row: row.rowNumber,
        error: err instanceof Error ? err.message : "Import failed"
      });
    }
  }

  return {
    created: created.length,
    updated: updated.length,
    failed,
    createdNames: created,
    updatedNames: updated
  };
}
