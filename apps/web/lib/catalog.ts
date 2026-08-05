import { query, queryOne } from "./db/pool";

export type StoreVariant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
  attributes: Record<string, unknown>;
};

export type StoreProduct = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  category: string;
  categoryName: string;
  type: string;
  collection: string;
  price: string;
  priceValue: number;
  compareAtPrice?: string;
  compareAtValue?: number;
  sizes: string[];
  imageSrc: string;
  images: string[];
  color: string;
  shortDescription: string;
  description: string;
  isFeatured: boolean;
  stock_quantity: number;
  variants: StoreVariant[];
};

export type StoreCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  image: string;
  subcategories: string[];
  lines: string[];
};

const CATEGORY_IMAGES: Record<string, string> = {
  sarees: "/hero-silk.png",
  jewelry: "/hero-jewelry.png",
  "churidhars-salwars": "/hero-salwar.png",
  handcrafted: "/catalog-wooden-item.png"
};

const CATEGORY_TONES = ["brown", "wine", "clay", "umber"] as const;

export function categoryImage(slug: string) {
  return CATEGORY_IMAGES[slug] || "/hero-silk.png";
}

export function categoryTone(index: number) {
  return CATEGORY_TONES[index % CATEGORY_TONES.length];
}

export function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `₹${amount.toLocaleString("en-IN")}`;
}

function shortName(name: string) {
  const parts = name.split(" ");
  return parts.length > 2 ? parts.slice(0, 2).join(" ") : name;
}

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string | null;
  color: string | null;
  is_featured: boolean;
  price: string;
  compare_at_price: string | null;
  stock_quantity: number;
  category_slug: string;
  category_name: string;
  subcategory_name: string | null;
};

type VariantRow = {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price: string;
  stock_quantity: number;
  attributes: Record<string, unknown>;
};

type ImageRow = {
  product_id: string;
  storage_path: string;
  sort_order: number;
};

function mapProduct(
  row: ProductRow,
  variants: VariantRow[],
  images: ImageRow[]
): StoreProduct {
  const productVariants = variants
    .filter((v) => v.product_id === row.id)
    .map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: Number(v.price),
      stock_quantity: Number(v.stock_quantity),
      attributes: v.attributes || {}
    }));

  const productImages = images
    .filter((img) => img.product_id === row.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((img) => img.storage_path);

  const imageSrc = productImages[0] || categoryImage(row.category_slug);
  const sizes =
    productVariants.length > 0
      ? productVariants.map((v) => v.name)
      : ["Free Size"];

  const priceValue = Number(row.price);
  const compareAtValue = row.compare_at_price != null ? Number(row.compare_at_price) : undefined;

  return {
    id: row.id,
    name: row.name,
    shortName: shortName(row.name),
    slug: row.slug,
    category: row.category_slug,
    categoryName: row.category_name,
    type: row.subcategory_name || row.category_name,
    collection: "",
    price: formatMoney(priceValue),
    priceValue,
    compareAtPrice: compareAtValue != null ? formatMoney(compareAtValue) : undefined,
    compareAtValue,
    sizes,
    imageSrc,
    images: productImages.length ? productImages : [imageSrc],
    color: row.color || "",
    shortDescription: row.short_description || "",
    description: row.description || "",
    isFeatured: Boolean(row.is_featured),
    stock_quantity: Number(row.stock_quantity),
    variants: productVariants
  };
}

async function loadVariantsAndImages(productIds: string[]) {
  if (!productIds.length) {
    return { variants: [] as VariantRow[], images: [] as ImageRow[] };
  }

  const [variants, images] = await Promise.all([
    query<VariantRow>(
      `select id, product_id, name, sku, price::text, stock_quantity, attributes
       from product_variants
       where product_id = any($1::uuid[])
       order by name asc`,
      [productIds]
    ),
    query<ImageRow>(
      `select product_id, storage_path, sort_order
       from product_images
       where product_id = any($1::uuid[])
       order by sort_order asc`,
      [productIds]
    )
  ]);

  return { variants, images };
}

export async function listActiveProducts(options?: { categorySlug?: string }) {
  const categorySlug = options?.categorySlug ?? null;
  const rows = await query<ProductRow>(
    `select
       p.id, p.name, p.slug, p.description, p.short_description, p.color, p.is_featured,
       p.price::text, p.compare_at_price::text,
       p.stock_quantity, c.slug as category_slug, c.name as category_name,
       sc.name as subcategory_name
     from products p
     join categories c on c.id = p.category_id
     left join subcategories sc on sc.id = p.subcategory_id
     where p.status::text = 'active'
       and ($1::text is null or c.slug = $1)
     order by p.is_featured desc, p.created_at desc`,
    [categorySlug]
  );

  const { variants, images } = await loadVariantsAndImages(rows.map((r) => r.id));
  return rows.map((row) => mapProduct(row, variants, images));
}

export async function getProductBySlug(slug: string) {
  const row = await queryOne<ProductRow>(
    `select
       p.id, p.name, p.slug, p.description, p.short_description, p.color, p.is_featured,
       p.price::text, p.compare_at_price::text,
       p.stock_quantity, c.slug as category_slug, c.name as category_name,
       sc.name as subcategory_name
     from products p
     join categories c on c.id = p.category_id
     left join subcategories sc on sc.id = p.subcategory_id
     where p.slug = $1 and p.status::text = 'active'`,
    [slug]
  );
  if (!row) return null;

  const { variants, images } = await loadVariantsAndImages([row.id]);
  return mapProduct(row, variants, images);
}

export async function listCategories(): Promise<StoreCategory[]> {
  const rows = await query<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    sort_order: number;
  }>(`select id, name, slug, description, sort_order from categories order by sort_order asc`);

  const subcats = await query<{ category_id: string; name: string }>(
    `select category_id, name from subcategories order by name asc`
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || "",
    sort_order: row.sort_order,
    image: categoryImage(row.slug),
    subcategories: subcats.filter((s) => s.category_id === row.id).map((s) => s.name),
    lines: [row.name]
  }));
}

export async function getCategoryBySlug(slug: string) {
  const categories = await listCategories();
  return categories.find((c) => c.slug === slug) ?? null;
}

export async function listCollections() {
  return query<{ id: string; name: string; slug: string; description: string | null }>(
    `select id, name, slug, description from collections order by name asc`
  );
}
