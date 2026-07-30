import Link from "next/link";
import Image from "next/image";
import { Search, ShoppingBag } from "lucide-react";
import { categories, products } from "../lib/mock-data";
import { NavigationBar } from "./navigation-bar";

export function Header() {
  return <>
    <div className="topbar" aria-label="Current Vasritha offers">
      <div className="offer-track">
        <span>FLAT 10% OFF ON YOUR FIRST ORDER — USE WELCOME10</span>
        <span>COMPLIMENTARY SHIPPING ON ORDERS ABOVE ₹2,500</span>
        <span>GET 15% OFF ON JEWELRY ABOVE ₹4,999 — USE SHINE15</span>
        <span aria-hidden="true">FLAT 10% OFF ON YOUR FIRST ORDER — USE WELCOME10</span>
        <span aria-hidden="true">COMPLIMENTARY SHIPPING ON ORDERS ABOVE ₹2,500</span>
        <span aria-hidden="true">GET 15% OFF ON JEWELRY ABOVE ₹4,999 — USE SHINE15</span>
      </div>
    </div>
    <header className="shell nav">
      <div className="nav-left"><NavigationBar /><Link className="search-link" href="/sarees" aria-label="Search catalog"><Search size={21} /></Link></div>
      <Link className="nav-logo-link" href="/" aria-label="Vasritha home"><img className="brand-logo" src="/vasritha-logo.png" alt="Vasritha — Timeless Elegance" /></Link>
      <div className="actions"><Link className="bag-link" href="/cart" aria-label="Shopping bag, 0 items"><ShoppingBag size={21} /><span>0</span></Link></div>
    </header>
  </>;
}

export function Footer() {
  return <footer className="footer"><div className="shell footer-grid">
    <div><img className="brand-logo" src="/vasritha-logo.png" alt="Vasritha — Timeless Elegance" /><p>Timeless elegance, thoughtfully curated. Discover sarees, jewelry, apparel and handcrafted treasures for your most meaningful moments.</p></div>
    <div><h4>Explore</h4>{categories.map((category) => <Link key={category.slug} href={`/${category.slug}`}>{category.name}</Link>)}</div>
    <div><h4>Customer Care</h4><a href="#">Shipping & Returns</a><a href="#">Contact Us</a><a href="#">Size Guide</a></div>
  </div></footer>;
}

export function ProductCard({ product }: { product: typeof products[number] }) {
  return <article className="card"><Link href={`/products/${product.slug}`}><div className="picture"><Image src={product.imageSrc} alt={product.name} fill sizes="(max-width: 800px) 50vw, 25vw" /><span>{product.type}</span></div></Link><div className="card-body"><div className="eyebrow">{product.type}</div><h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3><div className="price">{product.price}</div></div></article>;
}
