import { cachedOk } from "../../../lib/auth/api";
import { listCollections } from "../../../lib/catalog";

const COLLECTION_IMAGES: Record<string, { image: string; lines: string[] }> = {
  "kanchipuram-silk": { image: "/hero-silk.png", lines: ["Kanchipuram", "Silk"] },
  "banarasi-silk": { image: "/catalog-synthetic-saree.png", lines: ["Banarasi", "Silk"] },
  "soft-silk": { image: "/hero-salwar.png", lines: ["Soft", "Silk"] },
  "tussar-silk": { image: "/catalog-cotton-saree.png", lines: ["Tussar", "Silk"] },
  "cotton-weaves": { image: "/catalog-cotton-saree.png", lines: ["Cotton", "Weaves"] }
};

export async function GET() {
  const rows = await listCollections();
  const data = rows.map((row) => {
    const meta = COLLECTION_IMAGES[row.slug] || {
      image: "/hero-silk.png",
      lines: row.name.split(" ")
    };
    return {
      name: row.name,
      slug: row.slug,
      description: row.description,
      image: meta.image,
      lines: meta.lines,
      blurb: row.description || ""
    };
  });
  return cachedOk(data);
}
