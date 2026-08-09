/**
 * Seed homepage configuration with current storefront defaults (if empty).
 * Usage: npm run db:seed:homepage-config
 */
import pg from "pg";

const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/vasritha";

const client = new pg.Client({ connectionString: databaseUrl });

const OFFERS = [
  { message: "FLAT 10% OFF ON YOUR FIRST ORDER — USE WELCOME10", sort: 0 },
  { message: "COMPLIMENTARY SHIPPING ON ORDERS ABOVE ₹2,500", sort: 1 },
  { message: "GET 15% OFF ON JEWELRY ABOVE ₹4,999 — USE SHINE15", sort: 2 }
];

const HERO = [
  {
    image: "/hero-silk.png",
    alt: "Model wearing a Kanchipuram silk saree",
    title: "Elegance woven for every story.",
    subtitle:
      "Discover heirloom silks, luminous jewelry, graceful apparel, and handcrafted treasures curated with care.",
    cta_label: "Explore Sarees",
    cta_href: "/sarees",
    cta2_label: "Discover Jewelry",
    cta2_href: "/jewelry",
    sort: 0
  },
  {
    image: "/hero-salwar.png",
    alt: "Model wearing an embroidered churidhar salwar suit",
    title: "Elegance woven for every story.",
    subtitle:
      "Discover heirloom silks, luminous jewelry, graceful apparel, and handcrafted treasures curated with care.",
    cta_label: "Explore Sarees",
    cta_href: "/sarees",
    cta2_label: "Discover Jewelry",
    cta2_href: "/jewelry",
    sort: 1
  },
  {
    image: "/hero-jewelry.png",
    alt: "Model wearing traditional gold jewelry",
    title: "Elegance woven for every story.",
    subtitle:
      "Discover heirloom silks, luminous jewelry, graceful apparel, and handcrafted treasures curated with care.",
    cta_label: "Explore Sarees",
    cta_href: "/sarees",
    cta2_label: "Discover Jewelry",
    cta2_href: "/jewelry",
    sort: 2
  }
];

const STATUS = [
  { label: "New Sarees", image: "/hero-silk.png", href: "/sarees", sort: 0 },
  { label: "Festive Edit", image: "/hero-salwar.png", href: "/churidhars-salwars", sort: 1 },
  { label: "Jewelry Drop", image: "/hero-jewelry.png", href: "/jewelry", sort: 2 },
  { label: "Soft Cottons", image: "/catalog-cotton-saree.png", href: "/sarees", sort: 3 },
  { label: "Temple Bangles", image: "/catalog-bangles.png", href: "/jewelry", sort: 4 },
  { label: "Handcrafted", image: "/catalog-wooden-item.png", href: "/handcrafted", sort: 5 },
  { label: "Exclusive Offers", image: "/catalog-earrings.png", href: "/collections", sort: 6 }
];

const SHOWCASE = [
  {
    title: "Fresh Arrivals",
    subtitle: "From the boutique floor",
    media: "/boutique-01.mp4",
    sort: 0
  },
  {
    title: "Saree Stories",
    subtitle: "Timeless drapes",
    media: "/boutique-02.mp4",
    sort: 1
  },
  {
    title: "The Festive Rack",
    subtitle: "Chosen for celebrations",
    media: "/boutique-03.mp4",
    sort: 2
  },
  {
    title: "Curated for You",
    subtitle: "The Vasritha edit",
    media: "/boutique-04.mp4",
    sort: 3
  }
];

try {
  await client.connect();

  const offersCount = await client.query(`select count(*)::int as c from offer_ticker_items`);
  if (offersCount.rows[0].c === 0) {
    for (const row of OFFERS) {
      await client.query(
        `insert into offer_ticker_items (message, sort_order, is_active) values ($1, $2, true)`,
        [row.message, row.sort]
      );
    }
    console.log(`Seeded ${OFFERS.length} offer messages.`);
  } else {
    console.log("Offers already present — skipped.");
  }

  const heroCount = await client.query(`select count(*)::int as c from hero_slides`);
  if (heroCount.rows[0].c === 0) {
    for (const row of HERO) {
      await client.query(
        `insert into hero_slides (
           image_path, alt_text, title, subtitle,
           cta_label, cta_href, cta2_label, cta2_href, sort_order, is_active
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
        [
          row.image,
          row.alt,
          row.title,
          row.subtitle,
          row.cta_label,
          row.cta_href,
          row.cta2_label,
          row.cta2_href,
          row.sort
        ]
      );
    }
    console.log(`Seeded ${HERO.length} hero slides.`);
  } else {
    console.log("Hero slides already present — skipped.");
  }

  const statusCount = await client.query(`select count(*)::int as c from status_stories`);
  if (statusCount.rows[0].c === 0) {
    for (const row of STATUS) {
      await client.query(
        `insert into status_stories (label, image_path, href, display_date, sort_order, is_active)
         values ($1, $2, $3, current_date, $4, true)`,
        [row.label, row.image, row.href, row.sort]
      );
    }
    console.log(`Seeded ${STATUS.length} status stories for today.`);
  } else {
    console.log("Status stories already present — skipped.");
  }

  const showcaseCount = await client.query(`select count(*)::int as c from showcase_media`);
  if (showcaseCount.rows[0].c === 0) {
    for (const row of SHOWCASE) {
      await client.query(
        `insert into showcase_media (title, subtitle, media_path, media_type, sort_order, is_active)
         values ($1, $2, $3, 'video', $4, true)`,
        [row.title, row.subtitle, row.media, row.sort]
      );
    }
    console.log(`Seeded ${SHOWCASE.length} showcase media items.`);
  } else {
    console.log("Showcase media already present — skipped.");
  }
} catch (error) {
  console.error("Failed to seed homepage config:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
