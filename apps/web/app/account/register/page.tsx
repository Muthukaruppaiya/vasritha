import { Suspense } from "react";
import { CustomerRegisterForm } from "../../../components/customer-register-form";
import { Footer, Header } from "../../../components/storefront";

export default function CustomerRegisterPage() {
  return (
    <>
      <Header />
      <main className="shell section customer-page">
        <section className="customer-card" data-reveal>
          <div className="eyebrow">New customer</div>
          <h1>Create your profile</h1>
          <p className="muted">
            Add your details and a delivery address to continue to order summary and Razorpay payment.
          </p>
          <Suspense fallback={<p className="muted">Loading form…</p>}>
            <CustomerRegisterForm mode="register" />
          </Suspense>
        </section>
      </main>
      <Footer />
    </>
  );
}
