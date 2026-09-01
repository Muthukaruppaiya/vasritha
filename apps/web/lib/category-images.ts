const CATEGORY_IMAGES: Record<string, string> = {
  sarees: "/hero-silk.png",
  jewelry: "/hero-jewelry.png",
  "churidhars-salwars": "/hero-salwar.png",
  handcrafted: "/catalog-wooden-item.png"
};

export function categoryImage(slug: string) {
  return CATEGORY_IMAGES[slug] || "/hero-silk.png";
}

export function productListThumb(primaryImage: string | null | undefined, categorySlug?: string | null) {
  if (primaryImage) return primaryImage;
  return categoryImage(categorySlug || "sarees");
}
