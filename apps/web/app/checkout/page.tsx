import { Header } from "../../components/storefront";

export default function CheckoutPage() {
  return <><Header /><main className="shell section" style={{ maxWidth: 840 }}><div className="eyebrow">Secure checkout</div><h1 style={{ font: "500 3rem var(--font-heading),serif" }}>Complete your order</h1><div className="panel"><h3>1. Delivery details</h3><p className="muted">Address and contact fields will be connected to the customer profile when authentication is enabled.</p><h3>2. Payment</h3><p className="muted">Razorpay UPI, cards and netbanking will be enabled after live credentials and tax settings are configured.</p><button className="btn">Pay securely (demo)</button></div></main></>;
}
