import Link from "next/link";
import { Footer, Header } from "../../components/storefront";

export default function CartPage() {
  return <><Header /><main className="shell section"><div className="eyebrow">Your bag</div><h1 style={{ font: "500 3rem var(--font-heading),serif" }}>A beautiful selection awaits.</h1><div className="panel"><p className="muted">Your bag is empty in this wireframe. Add a piece from the collection to see the purchase flow.</p><Link className="btn" href="/sarees">Explore the collection</Link></div></main><Footer /></>;
}
