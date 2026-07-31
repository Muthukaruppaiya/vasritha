import Link from "next/link";
import Image from "next/image";
import { BuyButton } from "./buy-button";
import { categories, collections, products } from "../lib/mock-data";

export { Header } from "./site-header";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" data-reveal>
      <div className="shell footer-grid">
        <div className="footer-brand">
          <Link href="/" className="footer-logo-link" aria-label="Vasritha home">
            <span className="footer-logo-circle">
              <img className="footer-logo" src="/vasritha-logo-footer-circle.png" alt="Vasritha — Timeless Elegance" />
            </span>
          </Link>
          <p>Timeless elegance, thoughtfully curated. Discover sarees, jewelry, apparel and handcrafted treasures for your most meaningful moments.</p>
          <div className="footer-contact">
            <a href="mailto:hello@vasritha.com">hello@vasritha.com</a>
            <a href="tel:+919876543210">+91 98765 43210</a>
            <span>India · Worldwide shipping</span>
          </div>
        </div>

        <div>
          <h4>Explore</h4>
          <Link href="/">Home</Link>
          <Link href="/collections">All Collections</Link>
          {categories.map((category) => (
            <Link key={category.slug} href={`/${category.slug}`}>{category.name}</Link>
          ))}
          <Link href="/checkout">Offers</Link>
        </div>

        <div>
          <h4>Collections</h4>
          {collections.map((collection) => (
            <Link key={collection.name} href="/sarees">{collection.name}</Link>
          ))}
        </div>

        <div>
          <h4>Customer Care</h4>
          <Link href="/login">My Account</Link>
          <a href="#">Shipping & Returns</a>
          <a href="#">Size Guide</a>
          <a href="#">Order Tracking</a>
          <a href="#">FAQs</a>
          <a href="#">Contact Us</a>
        </div>

        <div>
          <h4>Stay Connected</h4>
          <p className="footer-note">Be first to know about new weaves, festive edits, and private offers.</p>
          <form className="footer-subscribe" action="#">
            <input type="email" name="email" placeholder="Your email" aria-label="Email for newsletter" required />
            <button type="submit">Join</button>
          </form>
          <div className="footer-social">
            <a href="#" aria-label="Instagram">Instagram</a>
            <a href="#" aria-label="Facebook">Facebook</a>
            <a href="#" aria-label="WhatsApp">WhatsApp</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="shell footer-bottom-inner">
          <p className="footer-copy">© {year} Vasritha. All rights reserved.</p>
          <div className="footer-legal">
            <a href="#">Privacy Policy</a>
            <span aria-hidden="true">·</span>
            <a href="#">Terms of Use</a>
          </div>
          <p className="footer-credit">
            Developed by{" "}
            <a href="https://gypsycode.com" target="_blank" rel="noreferrer">
              Gypsy Code
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export function ProductCard({
  product,
  variant = "default"
}: {
  product: typeof products[number];
  variant?: "default" | "listing";
}) {
  const isListing = variant === "listing";

  return (
    <article className={`card${isListing ? " card--listing" : ""}`}>
      <Link href={`/products/${product.slug}`}>
        <div className="picture">
          <Image src={product.imageSrc} alt={product.name} fill sizes="(max-width: 800px) 50vw, 25vw" />
          {!isListing && <span>{product.type}</span>}
        </div>
      </Link>
      <div className="card-body">
        {!isListing && <div className="eyebrow">{product.type}</div>}
        {isListing && <div className="card-type">{product.type}</div>}
        <h3>
          <Link href={`/products/${product.slug}`}>{isListing ? product.shortName : product.name}</Link>
        </h3>
        <div className="card-price-row">
          <div className="price">{product.price}</div>
          {product.compareAtPrice && <s className="card-compare">{product.compareAtPrice}</s>}
        </div>
        {isListing && (
          <div className="card-actions">
            {product.sizes.length > 1 ? (
              <Link href={`/products/${product.slug}`} className="card-buy-link">
                Select size & buy
              </Link>
            ) : (
              <BuyButton
                productSlug={product.slug}
                size={product.sizes[0]}
                className="btn card-buy-btn"
              >
                Buy
              </BuyButton>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
