import Link from "next/link";
import { orders, products } from "../../../lib/mock-data";

const nav = [
  ["Dashboard", "/admin"], ["Products", "/admin/products"], ["Categories", "/admin/categories"],
  ["Orders", "/admin/orders"], ["Billing", "/admin/billing"], ["Customers", "/admin/customers"]
];

function Table({ rows = orders }: { rows?: typeof orders }) {
  return <table className="table"><thead><tr><th>Reference</th><th>Customer / Detail</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.no}><td><b>{row.no}</b></td><td>{row.customer}</td><td>{row.date}</td><td>{row.total}</td><td><span className="badge">{row.status}</span></td></tr>)}</tbody></table>;
}

export default async function AdminPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section = [] } = await params;
  const active = section[0] ?? "dashboard";
  const title = active === "dashboard" ? "Good evening, Vasritha." : active.charAt(0).toUpperCase() + active.slice(1);
  const isBilling = active === "billing";
  return <div className="admin"><aside className="sidebar"><Link href="/" aria-label="Vasritha home"><img className="brand-logo" src="/vasritha-logo.png" alt="Vasritha" /></Link><div style={{ marginTop: 30 }}>{nav.map(([label, href]) => <Link href={href} key={label} className={(active === "dashboard" ? label === "Dashboard" : label.toLowerCase() === active) ? "active" : ""}>{label}</Link>)}</div></aside>
    <main className="admin-content"><div className="admin-top"><div><div className="eyebrow">Admin workspace</div><h1>{title}</h1></div><button className="btn" style={{ margin: 0 }}>+ New {active === "products" ? "product" : active === "billing" ? "invoice" : "order"}</button></div>
      {active === "dashboard" && <><section className="stats"><div className="stat"><span className="muted">Today’s sales</span><strong>₹26,340</strong><span className="muted">+12% vs yesterday</span></div><div className="stat"><span className="muted">Orders</span><strong>18</strong><span className="muted">5 awaiting dispatch</span></div><div className="stat"><span className="muted">Customers</span><strong>426</strong><span className="muted">+24 this month</span></div><div className="stat"><span className="muted">Low stock</span><strong>7</strong><span className="muted">Needs attention</span></div></section><section className="panel"><h3>Recent orders</h3><Table /></section></>}
      {active === "products" && <section className="panel"><h3>Product catalogue</h3><table className="table"><thead><tr><th>Product</th><th>Category</th><th>Collection</th><th>Price</th><th>Stock</th></tr></thead><tbody>{products.map((product, index) => <tr key={product.slug}><td><b>{product.name}</b></td><td>{product.type}</td><td>{product.collection || "—"}</td><td>{product.price}</td><td>{18 - index * 2}</td></tr>)}</tbody></table></section>}
      {active === "categories" && <section className="panel"><h3>Catalogue organisation</h3><p className="muted">Manage primary departments, subcategories and collection labels from one place.</p><div className="collection-strip" style={{ marginTop: 20 }}><div>Sarees<br /><small>3 subcategories</small></div><div>Jewelry<br /><small>3 subcategories</small></div><div>Churidhars / Salwars</div><div>Handcrafted<br /><small>2 subcategories</small></div><div>Collections<br /><small>5 labels</small></div></div></section>}
      {active === "orders" && <section className="panel"><h3>All orders</h3><Table /></section>}
      {active === "customers" && <section className="panel"><h3>Customer directory</h3><Table rows={orders} /></section>}
      {isBilling && <><section className="panel"><h3>Invoices</h3><Table /></section><section className="invoice"><div className="invoice-header"><div><img className="brand-logo" src="/vasritha-logo.png" alt="Vasritha" /><p className="muted">Timeless Elegance<br />India</p></div><div><div className="eyebrow">Tax invoice</div><h2>INV-2026-1024</h2><p className="muted">Issued: 30 Jul 2026</p></div></div><div style={{ display: "flex", justifyContent: "space-between", margin: "28px 0" }}><div><b>Bill to</b><p className="muted">Ananya Rao<br />Bengaluru, Karnataka</p></div><div><b>Order</b><p className="muted">VAS-1024<br />Paid via Razorpay</p></div></div><table className="table"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody><tr><td>Aarohi Kanchipuram Silk</td><td>1</td><td>₹10,975</td><td>₹10,975</td></tr><tr><td>GST (18%)</td><td>—</td><td>—</td><td>₹1,975</td></tr></tbody></table><div className="invoice-total">Total: ₹12,950</div></section></>}
    </main></div>;
}
