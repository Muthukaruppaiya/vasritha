export const categories = [
  { name: "Sarees", slug: "sarees", description: "Drapes made for your memorable moments.", subcategories: ["Silk Sarees", "Cotton Sarees", "Synthetic Sarees"] },
  { name: "Jewelry", slug: "jewelry", description: "Radiance in every detail.", subcategories: ["Bangles", "Earrings", "Necklace"] },
  { name: "Churidhars / Salwars", slug: "churidhars-salwars", description: "Graceful silhouettes for every day.", subcategories: [] },
  { name: "Handcrafted", slug: "handcrafted", description: "Artful objects made with care.", subcategories: ["Carved Wooden Items", "Brass / Metal Idols"] }
];

export const collections = ["Kanchipuram Silk", "Banarasi Silk", "Soft Silk", "Tussar Silk", "Cotton Weaves"];

export const products = [
  { name: "Aarohi Kanchipuram Silk", slug: "aarohi-kanchipuram-silk", category: "sarees", type: "Silk Sarees", collection: "Kanchipuram Silk", price: "₹12,950", imageSrc: "/hero-silk.png", description: "A regal crimson silk saree with a luminous temple-border zari weave." },
  { name: "Nandini Banarasi Weave", slug: "nandini-banarasi-weave", category: "sarees", type: "Silk Sarees", collection: "Banarasi Silk", price: "₹10,800", imageSrc: "/catalog-synthetic-saree.png", description: "A classic Banarasi silhouette that makes celebration effortless." },
  { name: "Meera Soft Silk", slug: "meera-soft-silk", category: "sarees", type: "Synthetic Sarees", collection: "Soft Silk", price: "₹7,450", imageSrc: "/catalog-synthetic-saree.png", description: "Light, polished, and beautifully draped for all-day elegance." },
  { name: "Sundari Cotton Weave", slug: "sundari-cotton-weave", category: "sarees", type: "Cotton Sarees", collection: "Cotton Weaves", price: "₹3,250", imageSrc: "/catalog-cotton-saree.png", description: "Breathable handwoven cotton with a quietly sophisticated border." },
  { name: "Lakshmi Temple Bangles", slug: "lakshmi-temple-bangles", category: "jewelry", type: "Bangles", collection: "", price: "₹2,900", imageSrc: "/catalog-bangles.png", description: "Antique-finish bangles with delicately sculpted temple motifs." },
  { name: "Chandrika Earrings", slug: "chandrika-earrings", category: "jewelry", type: "Earrings", collection: "", price: "₹1,850", imageSrc: "/catalog-earrings.png", description: "A bright, graceful pair to complete an occasion look." },
  { name: "Navratna Temple Necklace", slug: "navratna-temple-necklace", category: "jewelry", type: "Necklace", collection: "", price: "₹8,750", imageSrc: "/hero-jewelry.png", description: "A statement temple necklace finished with rich traditional details." },
  { name: "Hand-carved Lotus Panel", slug: "hand-carved-lotus-panel", category: "handcrafted", type: "Carved Wooden Items", collection: "", price: "₹4,600", imageSrc: "/catalog-wooden-item.png", description: "A warm, hand-finished wooden panel celebrating the lotus." },
  { name: "Brass Ganesha Idol", slug: "brass-ganesha-idol", category: "handcrafted", type: "Brass / Metal Idols", collection: "", price: "₹5,400", imageSrc: "/catalog-brass-idol.png", description: "A finely detailed brass idol for a cherished sacred corner." }
];

export const orders = [
  { no: "VAS-1024", customer: "Ananya Rao", date: "30 Jul 2026", total: "₹12,950", status: "Confirmed" },
  { no: "VAS-1023", customer: "Priya Nair", date: "29 Jul 2026", total: "₹7,450", status: "Processing" },
  { no: "VAS-1022", customer: "Meera Shah", date: "29 Jul 2026", total: "₹5,400", status: "Shipped" }
];
