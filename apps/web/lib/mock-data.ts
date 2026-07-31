export const categories = [
  { name: "Sarees", slug: "sarees", description: "Drapes made for your memorable moments.", subcategories: ["Silk Sarees", "Cotton Sarees", "Synthetic Sarees"], image: "/hero-silk.png", lines: ["Sarees"] },
  { name: "Jewelry", slug: "jewelry", description: "Radiance in every detail.", subcategories: ["Bangles", "Earrings", "Necklace"], image: "/hero-jewelry.png", lines: ["Jewelry"] },
  { name: "Churidhars / Salwars", slug: "churidhars-salwars", description: "Graceful silhouettes for every day.", subcategories: [], image: "/hero-salwar.png", lines: ["Churidhars", "Salwars"] },
  { name: "Handcrafted", slug: "handcrafted", description: "Artful objects made with care.", subcategories: ["Carved Wooden Items", "Brass / Metal Idols"], image: "/catalog-wooden-item.png", lines: ["Handcrafted"] }
];

export const collections = [
  { name: "Kanchipuram Silk", lines: ["Kanchipuram", "Silk"], image: "/hero-silk.png", blurb: "Temple borders & luminous zari" },
  { name: "Banarasi Silk", lines: ["Banarasi", "Silk"], image: "/catalog-synthetic-saree.png", blurb: "Celebration weaves, timeless grace" },
  { name: "Soft Silk", lines: ["Soft", "Silk"], image: "/hero-salwar.png", blurb: "Light drape for all-day elegance" },
  { name: "Tussar Silk", lines: ["Tussar", "Silk"], image: "/catalog-cotton-saree.png", blurb: "Raw texture with quiet luxury" },
  { name: "Cotton Weaves", lines: ["Cotton", "Weaves"], image: "/catalog-cotton-saree.png", blurb: "Breathable everyday refinement" }
];

export const spotlightSections = [
  {
    id: "fast-selling",
    eyebrow: "Most loved",
    title: "Fast Selling",
    lead: "Pieces our clients return for — and gift again.",
    href: "/collections",
    items: [
      { name: "Bridal Sarees", lines: ["Bridal", "Sarees"], href: "/sarees", image: "/hero-silk.png" },
      { name: "Temple Jewelry", lines: ["Temple", "Jewelry"], href: "/jewelry", image: "/hero-jewelry.png" },
      { name: "Festive Silks", lines: ["Festive", "Silks"], href: "/sarees", image: "/catalog-synthetic-saree.png" },
      { name: "Statement Bangles", lines: ["Statement", "Bangles"], href: "/jewelry", image: "/catalog-bangles.png" }
    ]
  },
  {
    id: "new-arrivals",
    eyebrow: "Just in",
    title: "New Arrivals",
    lead: "Fresh weaves and finishes for the season ahead.",
    href: "/collections",
    items: [
      { name: "Soft Drapes", lines: ["Soft", "Drapes"], href: "/sarees", image: "/hero-salwar.png" },
      { name: "Cotton Edits", lines: ["Cotton", "Edits"], href: "/sarees", image: "/catalog-cotton-saree.png" },
      { name: "Everyday Earrings", lines: ["Everyday", "Earrings"], href: "/jewelry", image: "/catalog-earrings.png" },
      { name: "Handcrafted Finds", lines: ["Handcrafted", "Finds"], href: "/handcrafted", image: "/catalog-wooden-item.png" }
    ]
  }
];

export const categoryBanners = [
  {
    slug: "sarees",
    brand: "Vasritha",
    titleLines: ["Saree", "Collections"],
    href: "/sarees",
    image: "/hero-silk.png",
    tone: "brown"
  },
  {
    slug: "jewelry",
    brand: "Vasritha",
    titleLines: ["Women's", "Accessories"],
    href: "/jewelry",
    image: "/hero-jewelry.png",
    tone: "wine"
  },
  {
    slug: "churidhars-salwars",
    brand: "Vasritha",
    titleLines: ["Casual", "Wear"],
    href: "/churidhars-salwars",
    image: "/hero-salwar.png",
    tone: "clay"
  },
  {
    slug: "handcrafted",
    brand: "Vasritha",
    titleLines: ["Handcrafted", "Treasures"],
    href: "/handcrafted",
    image: "/catalog-brass-idol.png",
    tone: "umber"
  }
];

export const products = [
  { name: "Aarohi Kanchipuram Silk", shortName: "Aarohi Silk", slug: "aarohi-kanchipuram-silk", category: "sarees", type: "Silk Sarees", collection: "Kanchipuram Silk", price: "₹12,950", compareAtPrice: "₹14,800", sizes: ["Free Size"], imageSrc: "/hero-silk.png", description: "A regal crimson silk saree with a luminous temple-border zari weave." },
  { name: "Nandini Banarasi Weave", shortName: "Nandini Banarasi", slug: "nandini-banarasi-weave", category: "sarees", type: "Silk Sarees", collection: "Banarasi Silk", price: "₹10,800", compareAtPrice: "₹12,500", sizes: ["Free Size"], imageSrc: "/catalog-synthetic-saree.png", description: "A classic Banarasi silhouette that makes celebration effortless." },
  { name: "Meera Soft Silk", shortName: "Meera Soft Silk", slug: "meera-soft-silk", category: "sarees", type: "Synthetic Sarees", collection: "Soft Silk", price: "₹7,450", compareAtPrice: "₹8,900", sizes: ["Free Size"], imageSrc: "/catalog-synthetic-saree.png", description: "Light, polished, and beautifully draped for all-day elegance." },
  { name: "Sundari Cotton Weave", shortName: "Sundari Cotton", slug: "sundari-cotton-weave", category: "sarees", type: "Cotton Sarees", collection: "Cotton Weaves", price: "₹3,250", compareAtPrice: "₹3,990", sizes: ["Free Size"], imageSrc: "/catalog-cotton-saree.png", description: "Breathable handwoven cotton with a quietly sophisticated border." },
  { name: "Lakshmi Temple Bangles", shortName: "Lakshmi Bangles", slug: "lakshmi-temple-bangles", category: "jewelry", type: "Bangles", collection: "", price: "₹2,900", compareAtPrice: "₹3,450", sizes: ["2.4", "2.6", "2.8", "2.10"], imageSrc: "/catalog-bangles.png", description: "Antique-finish bangles with delicately sculpted temple motifs." },
  { name: "Chandrika Earrings", shortName: "Chandrika Earrings", slug: "chandrika-earrings", category: "jewelry", type: "Earrings", collection: "", price: "₹1,850", compareAtPrice: "₹2,250", sizes: ["One Size"], imageSrc: "/catalog-earrings.png", description: "A bright, graceful pair to complete an occasion look." },
  { name: "Navratna Temple Necklace", shortName: "Navratna Necklace", slug: "navratna-temple-necklace", category: "jewelry", type: "Necklace", collection: "", price: "₹8,750", compareAtPrice: "₹9,990", sizes: ["One Size"], imageSrc: "/hero-jewelry.png", description: "A statement temple necklace finished with rich traditional details." },
  { name: "Hand-carved Lotus Panel", shortName: "Lotus Panel", slug: "hand-carved-lotus-panel", category: "handcrafted", type: "Carved Wooden Items", collection: "", price: "₹4,600", compareAtPrice: "₹5,200", sizes: ["One Size"], imageSrc: "/catalog-wooden-item.png", description: "A warm, hand-finished wooden panel celebrating the lotus." },
  { name: "Brass Ganesha Idol", shortName: "Brass Ganesha", slug: "brass-ganesha-idol", category: "handcrafted", type: "Brass / Metal Idols", collection: "", price: "₹5,400", compareAtPrice: "₹6,100", sizes: ["One Size"], imageSrc: "/catalog-brass-idol.png", description: "A finely detailed brass idol for a cherished sacred corner." }
];

export const orders = [
  { no: "VAS-1024", customer: "Ananya Rao", date: "30 Jul 2026", total: "₹12,950", status: "Confirmed" },
  { no: "VAS-1023", customer: "Priya Nair", date: "29 Jul 2026", total: "₹7,450", status: "Processing" },
  { no: "VAS-1022", customer: "Meera Shah", date: "29 Jul 2026", total: "₹5,400", status: "Shipped" }
];

/** General boutique reviews shown on the home page marquee */
export const storeReviews = [
  {
    id: "ananya-rao",
    name: "Ananya Rao",
    place: "Chennai",
    rating: 5,
    title: "Personal, polished curation",
    body: "Vasritha feels personal — every piece arrives with care, and the curation is always on point.",
    image: "/hero-silk.png",
    occasion: "Wedding guest look"
  },
  {
    id: "priya-nair",
    name: "Priya Nair",
    place: "Bengaluru",
    rating: 5,
    title: "Occasion dressing, simplified",
    body: "From sarees to jewelry, the boutique understands occasion dressing without the overwhelm.",
    image: "/hero-jewelry.png",
    occasion: "Festive edit"
  },
  {
    id: "meera-shah",
    name: "Meera Shah",
    place: "Mumbai",
    rating: 5,
    title: "As rich as the photos",
    body: "Packaging is beautiful, shipping is reliable, and the styles photograph as richly as they look in person.",
    image: "/catalog-synthetic-saree.png",
    occasion: "Celebration wear"
  },
  {
    id: "divya-krishnan",
    name: "Divya Krishnan",
    place: "Hyderabad",
    rating: 5,
    title: "Everyday and celebration, balanced",
    body: "Finally a place that balances everyday cotton weaves with celebration silks — truly thoughtful.",
    image: "/catalog-cotton-saree.png",
    occasion: "Daytime elegance"
  },
  {
    id: "sneha-iyer",
    name: "Sneha Iyer",
    place: "Coimbatore",
    rating: 4,
    title: "Guided, not sold to",
    body: "Customer care was warm and clear. I felt guided, not sold to — that is rare.",
    image: "/hero-salwar.png",
    occasion: "Boutique styling"
  },
  {
    id: "kavya-menon",
    name: "Kavya Menon",
    place: "Kochi",
    rating: 5,
    title: "Quiet luxury, intentional detail",
    body: "Quiet luxury done right. The finishes, borders, and details always feel intentional.",
    image: "/catalog-bangles.png",
    occasion: "Jewelry pairing"
  },
  {
    id: "riya-desai",
    name: "Riya Desai",
    place: "Ahmedabad",
    rating: 5,
    title: "Compliments all evening",
    body: "Ordered for a family function and received compliments all evening. Will be back for festive edits.",
    image: "/catalog-earrings.png",
    occasion: "Family function"
  },
  {
    id: "lakshmi-reddy",
    name: "Lakshmi Reddy",
    place: "Hyderabad",
    rating: 4,
    title: "Modern yet rooted",
    body: "Elegant pieces, honest descriptions, and a boutique experience that feels modern yet rooted.",
    image: "/catalog-brass-idol.png",
    occasion: "Lifestyle finds"
  }
];

/** Product-specific reviews shown on product detail pages */
export const productReviews = [
  {
    productSlug: "aarohi-kanchipuram-silk",
    name: "Ananya Rao",
    place: "Chennai",
    rating: 5,
    title: "A saree that felt ceremonial",
    body: "The zari caught the light beautifully at my sister’s wedding. Weight, drape, and border quality exceeded expectations."
  },
  {
    productSlug: "aarohi-kanchipuram-silk",
    name: "Shalini Kumar",
    place: "Madurai",
    rating: 5,
    title: "True Kanchipuram richness",
    body: "Temple border is crisp and the crimson tone is deep. Arrived perfectly packed and ready to wear."
  },
  {
    productSlug: "meera-soft-silk",
    name: "Priya Nair",
    place: "Bengaluru",
    rating: 5,
    title: "Soft, light, and so elegant",
    body: "Drapes easily for office events and still looks rich. Comfortable for long hours without losing shape."
  },
  {
    productSlug: "meera-soft-silk",
    name: "Nisha Patel",
    place: "Pune",
    rating: 4,
    title: "Everyday luxury",
    body: "Colour is true to the photos. Slightly sheer in strong light, but pairing with the right blouse made it perfect."
  },
  {
    productSlug: "navratna-temple-necklace",
    name: "Meera Shah",
    place: "Mumbai",
    rating: 5,
    title: "Jewelry with quiet detail",
    body: "Substantial without feeling heavy. Finish is refined, and it elevated a simple silk instantly."
  },
  {
    productSlug: "navratna-temple-necklace",
    name: "Aishwarya Rao",
    place: "Chennai",
    rating: 5,
    title: "Statement without excess",
    body: "The navratna work looks heirloom-worthy. Clasp is secure and the polish has held up beautifully."
  },
  {
    productSlug: "sundari-cotton-weave",
    name: "Divya Krishnan",
    place: "Hyderabad",
    rating: 4,
    title: "Breathable and refined",
    body: "Ideal for daytime functions. Border is understated and the cotton softens further after the first wash."
  },
  {
    productSlug: "nandini-banarasi-weave",
    name: "Isha Kapoor",
    place: "Delhi",
    rating: 5,
    title: "Celebration made effortless",
    body: "Classic Banarasi silhouette with a modern lightness. Received so many compliments at the reception."
  },
  {
    productSlug: "lakshmi-temple-bangles",
    name: "Rhea Nair",
    place: "Trivandrum",
    rating: 5,
    title: "Antique finish, perfect fit",
    body: "Motifs are delicately sculpted. Pair beautifully with both silk and soft cotton sarees."
  },
  {
    productSlug: "chandrika-earrings",
    name: "Tanvi Joshi",
    place: "Surat",
    rating: 5,
    title: "Bright and graceful",
    body: "Lightweight enough for all-day wear. Catch light without looking flashy — exactly what I wanted."
  },
  {
    productSlug: "brass-ganesha-idol",
    name: "Karthik Menon",
    place: "Bengaluru",
    rating: 5,
    title: "A cherished corner piece",
    body: "Detailing is fine and the brass has a warm, traditional presence. Packaging was reverent and secure."
  },
  {
    productSlug: "hand-carved-lotus-panel",
    name: "Anjali Das",
    place: "Kolkata",
    rating: 4,
    title: "Warm handcrafted texture",
    body: "Beautiful grain and lotus carving. Looks lovely above our pooja shelf — a quiet statement."
  }
];
