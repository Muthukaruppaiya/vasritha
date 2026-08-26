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
  subcategories: Array<{ id: string; name: string; slug: string }>;
  lines: string[];
  nameI18n?: Record<string, string>;
};

export type ListProductsOptions = {
  categorySlug?: string;
  subcategorySlug?: string;
  limit?: number;
  featuredOnly?: boolean;
  mode?: "card" | "detail";
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
  short_name: string | null;
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
  subcategory_slug: string | null;
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

function groupByProductId<T extends { product_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.product_id);
    if (list) list.push(row);
    else map.set(row.product_id, [row]);
  }
  return map;
}

function mapProduct(
  row: ProductRow,
  variantsByProduct: Map<string, VariantRow[]>,
  imagesByProduct: Map<string, ImageRow[]>,
  mode: "card" | "detail" = "detail"
): StoreProduct {
  const productVariants = (variantsByProduct.get(row.id) || []).map((v) => ({
    id: v.id,
    name: v.name,
    sku: v.sku,
    price: Number(v.price),
    stock_quantity: Number(v.stock_quantity),
    attributes: v.attributes || {}
  }));

  const productImages = (imagesByProduct.get(row.id) || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((img) => img.storage_path);

  const imageSrc = productImages[0] || categoryImage(row.category_slug);
  const sizes =
    productVariants.length > 0 ? productVariants.map((v) => v.name) : ["Free Size"];

  const priceValue = Number(row.price);
  const compareAtValue = row.compare_at_price != null ? Number(row.compare_at_price) : undefined;
  const isCard = mode === "card";

  const curatedShort = row.short_name?.trim();
  return {
    id: row.id,
    name: row.name,
    shortName: curatedShort || shortName(row.name),
    slug: row.slug,
    category: row.category_slug,
    categoryName: row.category_name,
    type: row.subcategory_name || row.category_name,
    collection: "",
    price: formatMoney(priceValue),
    priceValue,
    compareAtPrice: compareAtValue != null ? formatMoney(compareAtValue) : undefined,
    compareAtValue,
    sizes: isCard ? sizes.slice(0, 6) : sizes,
    imageSrc,
    images: isCard ? [imageSrc] : productImages.length ? productImages : [imageSrc],
    color: row.color || "",
    shortDescription: row.short_description || "",
    description: isCard ? "" : row.description || "",
    isFeatured: Boolean(row.is_featured),
    stock_quantity: Number(row.stock_quantity),
    variants: isCard ? [] : productVariants
  };
}

async function loadVariantsAndImages(productIds: string[], mode: "card" | "detail") {
  if (!productIds.length) {
    return {
      variantsByProduct: new Map<string, VariantRow[]>(),
      imagesByProduct: new Map<string, ImageRow[]>()
    };
  }

  if (mode === "card") {
    const images = await query<ImageRow>(
      `select distinct on (product_id) product_id, storage_path, sort_order
       from product_images
       where product_id = any($1::uuid[])
         and coalesce(image_kind::text, 'website') = 'website'
       order by product_id, sort_order asc`,
      [productIds]
    );
    const sizeRows = await query<{ product_id: string; name: string }>(
      `select product_id, name
       from product_variants
       where product_id = any($1::uuid[])
       order by name asc`,
      [productIds]
    );

    const variantsByProduct = new Map<string, VariantRow[]>();
    for (const row of sizeRows) {
      const list = variantsByProduct.get(row.product_id) || [];
      list.push({
        id: `${row.product_id}-${row.name}`,
        product_id: row.product_id,
        name: row.name,
        sku: "",
        price: "0",
        stock_quantity: 0,
        attributes: {}
      });
      variantsByProduct.set(row.product_id, list);
    }

    return {
      variantsByProduct,
      imagesByProduct: groupByProductId(images)
    };
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
         and coalesce(image_kind::text, 'website') = 'website'
       order by sort_order asc`,
      [productIds]
    )
  ]);

  return {
    variantsByProduct: groupByProductId(variants),
    imagesByProduct: groupByProductId(images)
  };
}

export async function listActiveProducts(options?: ListProductsOptions) {
  const categorySlug = options?.categorySlug ?? null;
  const subcategorySlug = options?.subcategorySlug ?? null;
  const featuredOnly = Boolean(options?.featuredOnly);
  const mode = options?.mode ?? "detail";
  const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 200) : null;

  const rows = await query<ProductRow>(
    `select
       p.id, p.name, p.short_name, p.slug, p.description, p.short_description, p.color, p.is_featured,
       p.price::text, p.compare_at_price::text,
       p.stock_quantity, c.slug as category_slug, c.name as category_name,
       sc.name as subcategory_name,
       sc.slug as subcategory_slug
     from products p
     join categories c on c.id = p.category_id
     left join subcategories sc on sc.id = p.subcategory_id
     where p.status = 'active'
       and ($1::text is null or c.slug = $1)
       and ($2::text is null or sc.slug = $2)
       and ($3::boolean = false or p.is_featured = true)
     order by p.is_featured desc, p.created_at desc
     ${limit ? `limit ${limit}` : ""}`,
    [categorySlug, subcategorySlug, featuredOnly]
  );

  const { variantsByProduct, imagesByProduct } = await loadVariantsAndImages(
    rows.map((r) => r.id),
    mode
  );
  return rows.map((row) => mapProduct(row, variantsByProduct, imagesByProduct, mode));
}

export async function listRelatedProducts(
  categorySlug: string,
  excludeSlug: string,
  limit = 4
) {
  const safeLimit = Math.min(Math.max(limit, 1), 24);
  const rows = await query<ProductRow>(
    `select
       p.id, p.name, p.short_name, p.slug, p.description, p.short_description, p.color, p.is_featured,
       p.price::text, p.compare_at_price::text,
       p.stock_quantity, c.slug as category_slug, c.name as category_name,
       sc.name as subcategory_name,
       sc.slug as subcategory_slug
     from products p
     join categories c on c.id = p.category_id
     left join subcategories sc on sc.id = p.subcategory_id
     where p.status = 'active'
       and c.slug = $1
       and p.slug <> $2
     order by p.is_featured desc, p.created_at desc
     limit ${safeLimit}`,
    [categorySlug, excludeSlug]
  );

  const { variantsByProduct, imagesByProduct } = await loadVariantsAndImages(
    rows.map((r) => r.id),
    "card"
  );
  return rows.map((row) => mapProduct(row, variantsByProduct, imagesByProduct, "card"));
}

export async function getProductBySlug(slug: string) {
  const row = await queryOne<ProductRow>(
    `select
       p.id, p.name, p.short_name, p.slug, p.description, p.short_description, p.color, p.is_featured,
       p.price::text, p.compare_at_price::text,
       p.stock_quantity, c.slug as category_slug, c.name as category_name,
       sc.name as subcategory_name,
       sc.slug as subcategory_slug
     from products p
     join categories c on c.id = p.category_id
     left join subcategories sc on sc.id = p.subcategory_id
     where p.slug = $1 and p.status = 'active'`,
    [slug]
  );
  if (!row) return null;

  const { variantsByProduct, imagesByProduct } = await loadVariantsAndImages([row.id], "detail");
  return mapProduct(row, variantsByProduct, imagesByProduct, "detail");
}

function mapCategoryRow(
  row: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_path?: string | null;
    sort_order: number;
    name_i18n?: Record<string, string> | null;
  },
  subcats: Array<{ id: string; category_id: string; name: string; slug: string }>
): StoreCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || "",
    sort_order: row.sort_order,
    image: row.image_path || categoryImage(row.slug),
    subcategories: subcats
      .filter((s) => s.category_id === row.id)
      .map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
    lines: [row.name],
    nameI18n: row.name_i18n || {}
  };
}

export async function listCategories(): Promise<StoreCategory[]> {
  const [rows, subcats] = await Promise.all([
    query<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      image_path: string | null;
      sort_order: number;
      name_i18n: Record<string, string> | null;
    }>(
      `select id, name, slug, description, image_path, sort_order, name_i18n from categories order by sort_order asc`
    ),
    query<{ id: string; category_id: string; name: string; slug: string }>(
      `select id, category_id, name, slug from subcategories order by name asc`
    )
  ]);

  return rows.map((row) => mapCategoryRow(row, subcats));
}

export async function getCategoryBySlug(slug: string) {
  const row = await queryOne<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_path: string | null;
    sort_order: number;
    name_i18n: Record<string, string> | null;
  }>(
    `select id, name, slug, description, image_path, sort_order, name_i18n from categories where slug = $1`,
    [slug]
  );
  if (!row) return null;

  const subcats = await query<{ id: string; category_id: string; name: string; slug: string }>(
    `select id, category_id, name, slug from subcategories where category_id = $1 order by name asc`,
    [row.id]
  );

  return mapCategoryRow(row, subcats);
}

export async function listCollections() {
  return query<{ id: string; name: string; slug: string; description: string | null }>(
    `select id, name, slug, description from collections order by name asc`
  );
}

export async function getStorefrontBootstrap() {
  const [settings, menus, banners, sections, categories] = await Promise.all([
    queryOne(`select * from site_settings limit 1`),
    query<{ id: string } & Record<string, unknown>>(`select * from menus where is_active = true`),
    query(`select * from banners where is_active = true order by sort_order`),
    query<{ id: string } & Record<string, unknown>>(
      `select * from page_sections where page_slug = 'home' and is_active = true order by sort_order`
    ),
    query(`select id, name, slug, description, sort_order from categories order by sort_order`)
  ]);

  const menuIds = menus.map((m) => m.id);
  const sectionIds = sections.map((s) => s.id);

  const [menuItems, sectionItems] = await Promise.all([
    menuIds.length
      ? query(`select * from menu_items where menu_id = any($1::uuid[])`, [menuIds])
      : Promise.resolve([]),
    sectionIds.length
      ? query(
          `select * from section_items where section_id = any($1::uuid[]) order by sort_order asc`,
          [sectionIds]
        )
      : Promise.resolve([])
  ]);

  return {
    settings,
    menus: menus.map((menu) => ({
      ...menu,
      menu_items: menuItems.filter((item) => (item as { menu_id: string }).menu_id === menu.id)
    })),
    banners,
    sections: sections.map((section) => ({
      ...section,
      section_items: sectionItems.filter(
        (item) => (item as { section_id: string }).section_id === section.id
      )
    })),
    categories
  };
}
