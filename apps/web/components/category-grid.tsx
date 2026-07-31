import Image from "next/image";
import Link from "next/link";
import { categories } from "../lib/mock-data";

export function CategoryGrid() {
  return (
    <section className="shell section category-grid-section">
      <div className="category-grid-head">
        <div className="category-grid-intro">
          <div className="eyebrow">Shop the boutique</div>
          <h2>Categories</h2>
        </div>
        <Link className="category-grid-link" href="/collections">All collections →</Link>
      </div>

      <div className="overlay-card-grid category-grid">
        {categories.map((category) => (
          <Link key={category.slug} href={`/${category.slug}`} className="overlay-card">
            <Image
              src={category.image}
              alt={category.name}
              fill
              sizes="(max-width:800px) 48vw, 24vw"
            />
            <span className="overlay-card-veil" aria-hidden="true" />
            <span className="overlay-card-title">
              {category.lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
