import ExcelJS from "exceljs";
import { query, queryOne } from "./db/pool";
import { subcategoryBelongsToCategory } from "./db/taxonomy";
import { ensureColourName, ensureColoursSchema, listProductColours } from "./colours";
import { ALLOWED_GST_RATES, normalizeHsn, normalizeGstRate, resolveSaleGstRate } from "./gst";
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
  { key: "name", label: "name *", required: true, hint: "MANDATORY — Product name" },
  { key: "short_name", label: "short_name", required: false, hint: "Short name for cards" },
  { key: "slug", label: "slug", required: false, hint: "URL slug (auto from name if blank)" },
  { key: "sku", label: "sku", required: false, hint: "Unique code (auto if blank)" },
  { key: "sku_prefix", label: "sku_prefix", required: false, hint: "VAS | PADH | VRSH" },
  { key: "tag", label: "tag", required: false, hint: "Piece tag / family tag" },
  { key: "barcode", label: "barcode", required: false, hint: "Family barcode (auto if blank)" },
  { key: "category", label: "category *", required: true, hint: "MANDATORY — Category name or slug" },
  { key: "subcategory", label: "subcategory", required: false, hint: "Subcategory name" },
  {
    key: "colour",
    label: "colour",
    required: false,
    hint: "Single-colour products only. Leave blank when is_multicolour = yes"
  },
  {
    key: "is_multicolour",
    label: "is_multicolour",
    required: false,
    hint: "yes / no — use colour_stock for colour-wise qty"
  },
  { key: "price", label: "price *", required: true, hint: "MANDATORY — Selling price (GST inclusive)" },
  { key: "compare_at_price", label: "compare_at_price", required: false, hint: "MRP / compare-at" },
  { key: "hsn_code", label: "hsn_code", required: false, hint: "4–8 digit HSN" },
  { key: "gst_rate", label: "gst_rate", required: false, hint: "0 | 3 | 5 | 9 | 12 | 18" },
  { key: "label_size", label: "label_size", required: false, hint: "dress | accessory" },
  { key: "status", label: "status", required: false, hint: "draft | pending_approval | active | archived" },
  {
    key: "opening_stock",
    label: "opening_stock",
    required: false,
    hint: "Single-colour only. For multicolour use colour_stock instead"
  },
  {
    key: "colour_stock",
    label: "colour_stock",
    required: false,
    hint: "Multicolour stock — format: Red:5, Green:3 (creates pieces per colour)"
  },
  { key: "short_description", label: "short_description", required: false, hint: "Max ~220 chars" },
  { key: "description", label: "description", required: false, hint: "Full description" },
  { key: "is_featured", label: "is_featured", required: false, hint: "yes / no — Fast selling" },
  { key: "restock_expected", label: "restock_expected", required: false, hint: "yes / no — Coming soon" },
  { key: "brand", label: "brand", required: false, hint: "Brand name (optional)" },
  { key: "parent_sku", label: "parent_sku", required: false, hint: "Parent product code (child designs)" }
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
  /** Parsed from colour_stock cell, e.g. Red:5, Green:3 */
  colour_batches: Array<{ color: string; count: number }>;
  colour_stock_raw: string;
  short_description: string;
  description: string;
  is_featured: boolean;
  restock_expected: boolean;
  brand: string;
  parent_sku: string;
  /** True when spreadsheet left sku blank — allocate PREFIX+YEAR+seq at import. */
  sku_auto: boolean;
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
    .replace(/\*+/g, "")
    .replace(/\(mandatory\)/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .replace(/color/, "colour")
    .replace(/^stock$/, "opening_stock")
    .replace(/^stock_quantity$/, "opening_stock")
    .replace(/^fast_selling$/, "is_featured")
    .replace(/^compare_at$/, "compare_at_price")
    .replace(/^category_name$/, "category")
    .replace(/^category_slug$/, "category")
    .replace(/^subcategory_name$/, "subcategory")
    .replace(/^color_stock$/, "colour_stock")
    .replace(/^stock_by_colour$/, "colour_stock")
    .replace(/^stock_by_color$/, "colour_stock");
}

/** Parse "Red:5, Green:3" / "Red=5; Green=3" / "Red:5 | Green:3". */
export function parseColourStock(raw: string): Array<{ color: string; count: number }> {
  const text = String(raw || "").trim();
  if (!text) return [];
  const parts = text.split(/[,;|]+/).map((p) => p.trim()).filter(Boolean);
  const batches: Array<{ color: string; count: number }> = [];
  for (const part of parts) {
    const m = part.match(/^(.+?)\s*[:=xX×]\s*(\d+)\s*$/);
    if (!m) {
      throw new Error(
        `Invalid colour_stock entry "${part}". Use Colour:qty — e.g. Red:5, Green:3`
      );
    }
    const color = m[1]!.trim();
    const count = Math.max(0, Math.trunc(Number(m[2])));
    if (!color || count <= 0) {
      throw new Error(`Invalid colour_stock entry "${part}". Colour and qty > 0 required`);
    }
    batches.push({ color, count });
  }
  return batches;
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

export type ImportLineError = { row: number; name: string; error: string };

/** Map spreadsheet rows; blank name rows are kept as errors via rowNumber. */
export function mapImportRows(raw: string[][]): ProductImportRow[] {
  if (!raw.length) return [];
  const headers = raw[0].map(normalizeHeader);
  const index = (key: string) => headers.indexOf(key);
  const nameIdx = index("name");
  if (nameIdx < 0) throw new Error("Missing required column: name * (or name)");

  const missingRequired = ["category", "price"].filter((key) => index(key) < 0);
  if (missingRequired.length) {
    throw new Error(`Missing required column(s): ${missingRequired.join(", ")}`);
  }

  const rows: ProductImportRow[] = [];
  const usedAutoSkus = new Set<string>();
  const usedSlugs = new Set<string>();
  raw.slice(1).forEach((values, idx) => {
    const name = (values[nameIdx] || "").trim();
    // Skip fully empty lines; keep named/partial rows for validation.
    if (!name && !values.some((v) => String(v || "").trim())) return;

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
    const skuProvided = get("sku").toUpperCase();
    let sku = skuProvided;
    const skuAuto = !skuProvided;
    if (skuAuto) {
      // Temp unique placeholder for validation; real PREFIX+YEAR+seq assigned at import.
      let attempt = 0;
      do {
        const stamp = Date.now().toString(36).toUpperCase().slice(-5);
        const seq = String(idx + 1).padStart(3, "0");
        const rand = Math.floor(Math.random() * 900 + 100);
        sku = `AUTO-${stamp}${seq}${rand}${attempt ? attempt : ""}`.slice(0, 32);
        attempt += 1;
      } while (usedAutoSkus.has(sku) && attempt < 20);
      usedAutoSkus.add(sku);
    }
    const priceRaw = get("price");
    const price = priceRaw === "" ? Number.NaN : Number(priceRaw);
    const compareRaw = get("compare_at_price");
    const stockRaw = get("opening_stock");
    const stock = stockRaw === "" ? 0 : Number(stockRaw);
    const labelRaw = (get("label_size") || "dress").toLowerCase();
    const gstRaw = get("gst_rate").replace(/%/g, "").trim();
    const colourStockRaw = get("colour_stock");
    let colourBatches: Array<{ color: string; count: number }> = [];
    let colourStockError = "";
    if (colourStockRaw) {
      try {
        colourBatches = parseColourStock(colourStockRaw);
      } catch (err) {
        colourStockError = err instanceof Error ? err.message : "Invalid colour_stock";
      }
    }
    // Same name + different price is allowed when slug is blank (auto-unique).
    // Explicit duplicate slugs still fail validation.
    const slugProvided = Boolean(get("slug"));
    let slug = get("slug") || (name ? slugify(name) : "");
    if (slug && !slugProvided) {
      const base = slugify(name) || `row-${idx + 2}`;
      if (usedSlugs.has(slug)) {
        const priced =
          Number.isFinite(price) && price > 0 ? `${base}-${Math.round(price)}` : "";
        if (priced && !usedSlugs.has(priced)) {
          slug = priced;
        } else {
          let n = 2;
          slug = `${base}-${n}`;
          while (usedSlugs.has(slug)) {
            n += 1;
            slug = `${base}-${n}`;
          }
        }
      }
      usedSlugs.add(slug);
    } else if (slug && slugProvided) {
      usedSlugs.add(slug);
    }

    const isMulticolour =
      truthy(get("is_multicolour")) || colourBatches.length > 0;

    rows.push({
      name,
      short_name: get("short_name"),
      slug,
      sku,
      sku_prefix: skuPrefix,
      tag: (get("tag") || sku).toUpperCase(),
      barcode:
        get("barcode") ||
        sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16),
      category: get("category"),
      subcategory: get("subcategory"),
      colour: get("colour"),
      is_multicolour: isMulticolour,
      price: Number.isFinite(price) ? price : Number.NaN,
      compare_at_price:
        compareRaw && Number.isFinite(Number(compareRaw)) ? Number(compareRaw) : null,
      hsn_code: normalizeHsn(get("hsn_code")),
      gst_rate: gstRaw && Number.isFinite(Number(gstRaw)) ? Number(gstRaw) : null,
      label_size: labelRaw === "accessory" ? "accessory" : "dress",
      status: get("status") || "draft",
      opening_stock: Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0,
      colour_batches: colourBatches,
      colour_stock_raw: colourStockError ? `__ERROR__:${colourStockError}` : colourStockRaw,
      short_description: get("short_description"),
      description: get("description"),
      is_featured: truthy(get("is_featured")),
      restock_expected: truthy(get("restock_expected")),
      brand: get("brand"),
      parent_sku: get("parent_sku").toUpperCase(),
      sku_auto: skuAuto,
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
    "MANDATORY columns (red headers): name *, category *, price *",
    "",
    "MULTICOLOUR STOCK (most sarees):",
    "  • Set is_multicolour = yes",
    "  • Put colour-wise qty in colour_stock, e.g. Red:5, Green:3, Blue:2",
    "  • Do NOT use opening_stock for multicolour rows",
    "",
    "SAME NAME, DIFFERENT PRICE:",
    "  • Allowed. Leave slug blank — system auto-makes unique slugs (e.g. 70080-660).",
    "",
    "1. Fill rows on the Products sheet. Do not rename column headers.",
    "2. Use dropdowns for category, subcategory, colours, status, yes/no fields.",
    "3. Upload checks every row first. Errors show as Line # in a popup.",
    "4. colour_stock / opening_stock create pieces only when the product still has 0 stock.",
    "5. Extra stock later → use GRN.",
    "6. Lookups sheet lists valid categories, subcategories, colours, and brands.",
    "",
    `Generated: ${new Date().toISOString().slice(0, 19)}`
  ];
  tips.forEach((line, i) => {
    const cell = instructions.getCell(i + 1, 1);
    cell.value = line;
    if (i === 0) cell.font = { bold: true, size: 14, color: { argb: "FF2B1A10" } };
    if (i === 2 || i === 4 || i === 9) cell.font = { bold: true, color: { argb: "FFB91C1C" } };
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
    cell.font = {
      bold: true,
      color: { argb: col.required ? "FFFFFFFF" : "FF2B1A10" }
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: col.required ? "FFDC2626" : "FFF5EDE4" }
    };
    cell.border = {
      top: { style: "thin", color: { argb: col.required ? "FF991B1B" : "FFDFCABB" } },
      left: { style: "thin", color: { argb: col.required ? "FF991B1B" : "FFDFCABB" } },
      bottom: { style: "thin", color: { argb: col.required ? "FF991B1B" : "FFDFCABB" } },
      right: { style: "thin", color: { argb: col.required ? "FF991B1B" : "FFDFCABB" } }
    };
    cell.note = col.hint;
    products.getColumn(i + 1).width = Math.min(30, Math.max(14, col.label.length + 4));
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
    colour: "",
    is_multicolour: "yes",
    price: 8990,
    compare_at_price: 9990,
    hsn_code: "5407",
    gst_rate: 5,
    label_size: "dress",
    status: "draft",
    opening_stock: "",
    colour_stock: `${colours[0]?.name || "Maroon"}:2, ${colours[1]?.name || "Green"}:1`,
    short_description: "Sample multicolour row — delete or replace",
    description: "",
    is_featured: "no",
    restock_expected: "no",
    brand: brands[0]?.name || "",
    parent_sku: ""
  };
  PRODUCT_IMPORT_COLUMNS.forEach((col, i) => {
    const cell = products.getCell(2, i + 1);
    cell.value = sample[col.key] ?? "";
    if (col.required) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEE2E2" }
      };
    }
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
  checked: number;
};

export type ImportValidateResult = {
  ok: boolean;
  checked: number;
  errors: ImportLineError[];
};

async function loadImportTaxonomy() {
  const categories = await query<{ id: string; slug: string; name: string }>(
    `select id, slug, name from categories`
  );
  const subcategories = await query<{
    id: string;
    name: string;
    category_id: string;
  }>(`select id, name, category_id from subcategories`);
  return {
    categories,
    subcategories,
    byCatSlug: new Map(categories.map((c) => [c.slug.toLowerCase(), c])),
    byCatName: new Map(categories.map((c) => [c.name.toLowerCase(), c]))
  };
}

function resolveSubcategoryId(
  categoryId: string,
  subRaw: string,
  subcategories: Array<{ id: string; name: string; category_id: string }>
) {
  if (!subRaw.trim()) return null;
  const plain = subRaw.includes("|") ? subRaw.split("|").pop()!.trim() : subRaw.trim();
  const matches = subcategories.filter(
    (s) => s.category_id === categoryId && s.name.toLowerCase() === plain.toLowerCase()
  );
  return matches[0]?.id || null;
}

/** Dry-run: check every row before writing anything. */
export async function validateProductImportRows(
  rows: ProductImportRow[]
): Promise<ImportValidateResult> {
  const { byCatSlug, byCatName, subcategories } = await loadImportTaxonomy();
  const errors: ImportLineError[] = [];
  const seenSku = new Map<string, number>();
  const seenSlug = new Map<string, number>();

  for (const row of rows) {
    const label = row.name.trim() || "(blank name)";
    if (!row.name.trim()) {
      errors.push({ row: row.rowNumber, name: label, error: "name * is required" });
      continue;
    }
    if (!row.category.trim()) {
      errors.push({ row: row.rowNumber, name: label, error: "category * is required" });
    }
    if (!Number.isFinite(row.price) || row.price < 0) {
      errors.push({ row: row.rowNumber, name: label, error: "price * must be a valid number ≥ 0" });
    }
    if (!row.is_multicolour && !row.colour.trim()) {
      errors.push({
        row: row.rowNumber,
        name: label,
        error: "colour is required unless is_multicolour = yes (or colour_stock is set)"
      });
    }
    if (row.colour_stock_raw.startsWith("__ERROR__:")) {
      errors.push({
        row: row.rowNumber,
        name: label,
        error: row.colour_stock_raw.replace(/^__ERROR__:/, "")
      });
    }
    if (
      row.is_multicolour &&
      row.opening_stock > 0 &&
      row.colour_batches.length === 0 &&
      !row.colour_stock_raw.startsWith("__ERROR__:")
    ) {
      errors.push({
        row: row.rowNumber,
        name: label,
        error:
          "Multicolour stock must use colour_stock (e.g. Red:5, Green:3) — not opening_stock alone"
      });
    }

    const category =
      byCatSlug.get(row.category.toLowerCase()) || byCatName.get(row.category.toLowerCase());
    if (row.category.trim() && !category) {
      errors.push({
        row: row.rowNumber,
        name: label,
        error: `Unknown category: ${row.category}`
      });
    }
    if (category && row.subcategory.trim()) {
      const subId = resolveSubcategoryId(category.id, row.subcategory, subcategories);
      if (!subId) {
        const plain = row.subcategory.includes("|")
          ? row.subcategory.split("|").pop()!.trim()
          : row.subcategory.trim();
        errors.push({
          row: row.rowNumber,
          name: label,
          error: `Unknown subcategory for ${category.name}: ${plain}`
        });
      }
    }

    if (row.sku) {
      const prev = seenSku.get(row.sku);
      if (prev) {
        errors.push({
          row: row.rowNumber,
          name: label,
          error: `Duplicate sku in file (also line ${prev}): ${row.sku}`
        });
      } else {
        seenSku.set(row.sku, row.rowNumber);
      }
    }
    if (row.slug) {
      const prev = seenSlug.get(row.slug);
      if (prev) {
        errors.push({
          row: row.rowNumber,
          name: label,
          error: `Duplicate slug in file (also line ${prev}): ${row.slug}`
        });
      } else {
        seenSlug.set(row.slug, row.rowNumber);
      }
    }

    if (row.opening_stock < 0 || !Number.isFinite(row.opening_stock)) {
      errors.push({
        row: row.rowNumber,
        name: label,
        error: "opening_stock must be a whole number ≥ 0"
      });
    }

    // Mirror the DB write: only allow rates the products_gst_rate_chk accepts.
    if (row.gst_rate != null) {
      const provided = Number(row.gst_rate);
      if (
        !Number.isFinite(provided) ||
        !(ALLOWED_GST_RATES as readonly number[]).includes(provided)
      ) {
        errors.push({
          row: row.rowNumber,
          name: label,
          error: `gst_rate must be one of ${ALLOWED_GST_RATES.join(", ")} (got ${row.gst_rate})`
        });
      }
    }
    const resolvedGst = resolveSaleGstRate({
      hsnCode: row.hsn_code,
      saleValuePerPiece: row.price,
      fallbackRate: row.gst_rate
    });
    if (!(ALLOWED_GST_RATES as readonly number[]).includes(resolvedGst)) {
      errors.push({
        row: row.rowNumber,
        name: label,
        error: `Resolved GST rate ${resolvedGst}% is not allowed (use ${ALLOWED_GST_RATES.join(", ")})`
      });
    }
  }

  return { ok: errors.length === 0, checked: rows.length, errors };
}

export async function runProductImport(input: {
  rows: ProductImportRow[];
  actorUserId: string;
  roles: AppRole[];
}): Promise<ImportRunResult> {
  const canApprove = canApproveProducts(input.roles || []);
  const { byCatSlug, byCatName, subcategories } = await loadImportTaxonomy();

  const created: string[] = [];
  const updated: string[] = [];
  const failed: Array<{ name: string; row?: number; error: string }> = [];

  for (const row of input.rows) {
    try {
      if (!row.name.trim()) {
        failed.push({ name: "(blank)", row: row.rowNumber, error: "name * is required" });
        continue;
      }
      if (!Number.isFinite(row.price) || row.price < 0) {
        failed.push({ name: row.name, row: row.rowNumber, error: "Valid price * is required" });
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
        subcategoryId = resolveSubcategoryId(category.id, subRaw, subcategories);
        if (!subcategoryId) {
          const plain = subRaw.includes("|") ? subRaw.split("|").pop()!.trim() : subRaw;
          failed.push({
            name: row.name,
            row: row.rowNumber,
            error: `Unknown subcategory for ${category.name}: ${plain}`
          });
          continue;
        }
      }
      if (!(await subcategoryBelongsToCategory(category.id, subcategoryId))) {
        failed.push({
          name: row.name,
          row: row.rowNumber,
          error: "Subcategory must belong to the selected category"
        });
        continue;
      }

      const isMulticolour = row.is_multicolour || row.colour_batches.length > 0;
      const productColor = isMulticolour ? "" : row.colour.trim();
      if (!isMulticolour && !productColor) {
        failed.push({
          name: row.name,
          row: row.rowNumber,
          error: "colour is required unless is_multicolour = yes (or colour_stock is set)"
        });
        continue;
      }
      if (row.colour_stock_raw.startsWith("__ERROR__:")) {
        failed.push({
          name: row.name,
          row: row.rowNumber,
          error: row.colour_stock_raw.replace(/^__ERROR__:/, "")
        });
        continue;
      }
      if (productColor) await ensureColourName(productColor);
      for (const batch of row.colour_batches) {
        await ensureColourName(batch.color);
      }

      const status = normalizeProductStatus(row.status, {
        canApprove,
        fallback: canApprove ? "draft" : "pending_approval"
      }) as ProductStatus;

      const gstRate = normalizeGstRate(
        resolveSaleGstRate({
          hsnCode: row.hsn_code,
          saleValuePerPiece: row.price,
          fallbackRate: row.gst_rate
        }),
        5
      );
      if (!(ALLOWED_GST_RATES as readonly number[]).includes(gstRate)) {
        failed.push({
          name: row.name,
          row: row.rowNumber,
          error: `gst_rate must be one of ${ALLOWED_GST_RATES.join(", ")} (got ${gstRate})`
        });
        continue;
      }

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
            error: `Parent product not found: ${row.parent_sku}`
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

      let sku = row.sku;
      let tag = row.tag;
      let familyBarcode = row.barcode.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16);
      if (row.sku_auto) {
        const { nextDocumentNumber } = await import("./document-numbers");
        sku = await nextDocumentNumber("product");
        tag = (row.tag && !row.tag.startsWith("AUTO-") ? row.tag : sku).toUpperCase();
        familyBarcode =
          row.barcode && !row.barcode.startsWith("AUTO")
            ? familyBarcode
            : sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16);
      }

      const existing = await queryOne<{ id: string }>(
        `select id from products where slug = $1 or ($2::text <> '' and sku = $2) limit 1`,
        [row.slug, row.sku_auto ? "" : sku]
      );
      const colourBatches = row.colour_batches;
      const openingStock = colourBatches.length
        ? colourBatches.reduce((sum, b) => sum + b.count, 0)
        : isMulticolour
          ? 0
          : row.opening_stock;

      const applyStockIfEmpty = async (productId: string, variantId: string) => {
        if (openingStock <= 0 && colourBatches.length === 0) return;
        const existingPieces = await queryOne<{ c: number }>(
          `select count(*)::int as c from product_items where product_id = $1`,
          [productId]
        );
        if (Number(existingPieces?.c || 0) > 0) return;
        await createUnitsAndSync({
          productId,
          variantId,
          tag: tag.toUpperCase(),
          sku,
          count: colourBatches.length ? 0 : openingStock,
          color: colourBatches.length ? null : productColor || null,
          colorBatches: colourBatches.length ? colourBatches : undefined
        });
      };

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
            sku,
            familyBarcode,
            tag.toUpperCase(),
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
        const variant = await upsertDefaultVariant({
          productId: existing.id,
          sku,
          barcode: familyBarcode,
          price: row.price
        });
        if (variant?.id) await applyStockIfEmpty(existing.id, variant.id);
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
            sku,
            familyBarcode,
            tag.toUpperCase(),
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
          sku,
          barcode: familyBarcode,
          price: row.price
        });
        if (variant?.id) await applyStockIfEmpty(data.id, variant.id);
        await recordPriceHistory(data.id, row.price);
        await writeAuditLog({
          actorUserId: input.actorUserId,
          action: "import_create",
          entityType: "products",
          entityId: data.id,
          after: {
            ...data,
            opening_stock: openingStock,
            colour_stock: colourBatches
          }
        });
        created.push(row.name);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Import failed";
      let message = raw;
      if (/products_gst_rate_chk/i.test(raw)) {
        message = `Invalid gst_rate — must be one of ${ALLOWED_GST_RATES.join(", ")}`;
      } else if (/violates check constraint/i.test(raw)) {
        message = `Database rejected this row (${raw.replace(/^.*constraint "/, "").replace(/".*$/, "") || "check constraint"})`;
      } else if (/duplicate key|unique constraint/i.test(raw)) {
        message = "Duplicate product code / slug / barcode already exists";
      }
      failed.push({
        name: row.name,
        row: row.rowNumber,
        error: message
      });
    }
  }

  return {
    created: created.length,
    updated: updated.length,
    failed,
    createdNames: created,
    updatedNames: updated,
    checked: input.rows.length
  };
}
