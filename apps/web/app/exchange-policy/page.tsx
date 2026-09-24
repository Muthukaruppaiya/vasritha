import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Header } from "../../components/storefront";
import {
  buildPurchasePolicySummary,
  getExchangePolicySettings
} from "../../lib/exchange-policy";
import { formatPrice } from "../../lib/cart";

export const metadata: Metadata = {
  title: "Exchange Policy | Vasritha",
  description: "Vasritha exchange-only policy — no cash refunds. Eligibility, timelines and process."
};

export const dynamic = "force-dynamic";

export default async function ExchangePolicyPage() {
  const settings = await getExchangePolicySettings();
  const summary = buildPurchasePolicySummary(settings);

  return (
    <>
      <Header />
      <main className="shell section policy-page" data-reveal>
        <header className="policy-hero">
          <p className="eyebrow">Customer care</p>
          <h1>Exchange Policy</h1>
          <p className="muted policy-lead">
            Please read this before you order. Our boutique operates on an{" "}
            <strong>exchange-only</strong> basis for online orders.
          </p>
        </header>

        <div className="policy-banner policy-banner--warn" role="note">
          <strong>{summary.no_refund_headline}</strong>
          <p>{summary.no_refund_body}</p>
        </div>

        {summary.in_store_only ? (
          <div className="policy-banner" role="note">
            <strong>IN-STORE PURCHASES</strong>
            <p>{summary.in_store_text}</p>
          </div>
        ) : null}

        <div className="policy-grid">
          <article className="policy-card">
            <h2>Online orders</h2>
            <p>{summary.online_summary}</p>
            <p className="muted">
              Online refunds are not available when the no-refund policy is enabled. Use the exchange
              request on your order page instead.
            </p>
          </article>

          <article className="policy-card">
            <h2>Exchange eligibility</h2>
            {summary.exchange_enabled ? (
              <p>
                Exchanges are <strong>available</strong> for paid, delivered online orders within the
                configured window, subject to product condition and category rules.
              </p>
            ) : (
              <p>
                Online exchange requests are <strong>temporarily unavailable</strong>. Please visit
                or contact the boutique.
              </p>
            )}
          </article>

          <article className="policy-card">
            <h2>Exchange period</h2>
            <p>
              {settings.exchange_window_days > 0 ? (
                <>
                  You may request an exchange within{" "}
                  <strong>{settings.exchange_window_days} day(s)</strong> of delivery.
                </>
              ) : (
                <>No fixed day limit is configured — eligibility is confirmed at the boutique.</>
              )}
            </p>
          </article>

          <article className="policy-card">
            <h2>Product condition</h2>
            <p>{summary.condition_text}</p>
          </article>

          <article className="policy-card">
            <h2>Non-exchangeable items</h2>
            <p>{summary.non_eligible_text}</p>
          </article>

          <article className="policy-card">
            <h2>Exchange process</h2>
            <p>{summary.process_text}</p>
            <ol className="policy-list">
              <li>Open your order and choose items to exchange.</li>
              <li>Share a reason and submit the request.</li>
              <li>Wait for boutique approval.</li>
              <li>Return the product in original condition with the bill.</li>
              <li>Select a replacement of equal or higher value (difference payable).</li>
            </ol>
          </article>

          <article className="policy-card">
            <h2>Exchange / delivery charges</h2>
            {settings.exchange_charge > 0 ? (
              <p>
                An exchange handling charge of{" "}
                <strong>{formatPrice(settings.exchange_charge)}</strong> may apply (confirmed by the
                boutique when your request is reviewed).
              </p>
            ) : (
              <p>
                No fixed exchange fee is configured. Any courier return costs are as agreed with the
                boutique.
              </p>
            )}
          </article>

          {summary.notes ? (
            <article className="policy-card policy-span-2">
              <h2>Additional conditions</h2>
              <p className="policy-notes">{summary.notes}</p>
            </article>
          ) : null}
        </div>

        <div className="policy-actions">
          <Link className="btn" href="/account/orders">
            My orders
          </Link>
          <Link className="policy-text-link" href="/shipping-policy">
            Shipping policy
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
