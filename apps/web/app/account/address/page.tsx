import { Suspense } from "react";
import { CustomerRegisterForm } from "../../../components/customer-register-form";
import { Footer, Header } from "../../../components/storefront";

export default function CustomerAddressPage() {
  return (
    <>
      <Header />
      <main className="shell section customer-page">
        <section className="customer-card" data-reveal>
          <div className="eyebrow">Delivery</div>
          <h1>Add a new address</h1>
          <p className="muted">Save a delivery address to continue to payment summary.</p>
          <Suspense fallback={<p className="muted">Loading form…</p>}>
            <CustomerRegisterForm mode="address" />
          </Suspense>
        </section>
      </main>
      <Footer />
    </>
  );
}
