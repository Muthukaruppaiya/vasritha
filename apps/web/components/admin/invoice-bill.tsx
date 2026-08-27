"use client";

import { formatDate, formatMoney } from "../../lib/admin-api";
import type { ThermalReceiptData, ThermalReceiptItem } from "./thermal-receipt";

export type InvoiceBillData = ThermalReceiptData;
export type InvoiceBillItem = ThermalReceiptItem;

type Props = {
  data: InvoiceBillData;
  id?: string;
};

function formatReceiptDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

/** Compact textile-shop GST bill: 5" wide, height follows content (auto-cut). */
export function InvoiceBill({ data, id = "vasritha-invoice-bill" }: Props) {
  const isPos = data.channel === "pos";
  const discount = Number(data.discount_amount || 0);
  const shipping = Number(data.shipping_amount || 0);
  const lines = Array.isArray(data.items) ? data.items : [];
  const itemCount = lines.reduce((sum, item) => sum + Number(item.quantity), 0);
  const seller = data.seller;
  const hasGstin = Boolean(seller?.gstin);
  const gst = data.gst;
  const showCgst = Boolean(gst && (gst.cgst > 0 || gst.sgst > 0));
  const showIgst = Boolean(gst && gst.igst > 0);

  return (
    <article className="invoice-bill invoice-bill--shop" id={id}>
      <header className="invoice-bill-shop-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vasritha-logo.svg" alt="" className="invoice-bill-logo" />
        <div className="invoice-bill-shop-title">
          <strong>{seller?.legal_name || "VASRITHA"}</strong>
          <span>Timeless Elegance · Textile &amp; Lifestyle</span>
          {seller?.shop_code ? (
            <span className="invoice-bill-shop-code-line">
              Shop: {seller.shop_name || seller.legal_name}
              {seller.shop_code ? ` · ${seller.shop_code}` : ""}
            </span>
          ) : null}
          <em>{hasGstin ? "Tax Invoice" : isPos ? "Store counter bill" : "Online order bill"}</em>
        </div>
      </header>

      {(seller?.address || seller?.gstin || seller?.state || seller?.phone) && (
        <div className="invoice-bill-shop-seller">
          {seller?.address ? <p>{seller.address}</p> : null}
          {seller?.state ? (
            <p>
              State: {seller.state}
              {seller.state_code ? ` (${seller.state_code})` : ""}
            </p>
          ) : null}
          {seller?.gstin ? (
            <p>
              <b>GSTIN:</b> {seller.gstin}
            </p>
          ) : null}
          {seller?.phone ? <p>Ph: {seller.phone}</p> : null}
        </div>
      )}

      <div className="invoice-bill-shop-meta">
        <div>
          <span>Invoice no.</span>
          <b>INV-{data.order_number}</b>
        </div>
        <div>
          <span>Date</span>
          <b>{formatReceiptDate(data.created_at)}</b>
        </div>
        <div>
          <span>Payment</span>
          <b>{data.payment_status.toUpperCase()}</b>
        </div>
        <div>
          <span>Items</span>
          <b>{itemCount}</b>
        </div>
      </div>

      <div className="invoice-bill-shop-customer">
        <div>
          <span>Customer</span>
          <b>{data.customer_name || (isPos ? "Walk-in" : "Customer")}</b>
        </div>
        {data.customer_phone ? (
          <div>
            <span>Mobile</span>
            <b>{data.customer_phone}</b>
          </div>
        ) : null}
        {data.customer_email ? (
          <div>
            <span>Email</span>
            <b>{data.customer_email}</b>
          </div>
        ) : null}
      </div>

      {!isPos && data.shipping_address ? (
        <div className="invoice-bill-shop-ship">
          <span>Deliver to / Place of supply</span>
          <b>{data.shipping_address.recipient_name}</b>
          <p>
            {data.shipping_address.line1}
            {data.shipping_address.line2 ? `, ${data.shipping_address.line2}` : ""}
            {`, ${data.shipping_address.city}, ${data.shipping_address.state} ${data.shipping_address.postal_code}`}
          </p>
          <p>Ph: {data.shipping_address.phone}</p>
        </div>
      ) : null}

      <table className="invoice-bill-table invoice-bill-table--shop">
        <thead>
          <tr>
            <th className="is-no">#</th>
            <th className="is-item">Particulars</th>
            <th className="is-hsn">HSN</th>
            <th className="is-qty">Qty</th>
            <th className="is-rate">Rate</th>
            <th className="is-amt">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.length ? (
            lines.map((item, index) => (
              <tr key={`${item.product_id}-${index}`}>
                <td className="is-no">{index + 1}</td>
                <td className="is-item">
                  <b>
                    {item.product_name}
                    {item.variant_name ? ` · ${item.variant_name}` : ""}
                  </b>
                  <span>
                    {item.sku ? `${item.sku}` : ""}
                    {item.gst_rate != null ? ` · GST ${Number(item.gst_rate)}%` : ""}
                  </span>
                </td>
                <td className="is-hsn">{item.hsn_code || "—"}</td>
                <td className="is-qty">{item.quantity}</td>
                <td className="is-rate">{formatMoney(item.unit_price)}</td>
                <td className="is-amt">{formatMoney(item.line_total)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6}>No items on this bill.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="invoice-bill-shop-totals">
        <div>
          <span>Subtotal</span>
          <b>{formatMoney(data.subtotal)}</b>
        </div>
        {discount > 0 ? (
          <div>
            <span>Discount</span>
            <b>-{formatMoney(discount)}</b>
          </div>
        ) : null}
        {!isPos && shipping > 0 ? (
          <div>
            <span>Shipping</span>
            <b>{formatMoney(shipping)}</b>
          </div>
        ) : null}
        {gst ? (
          <>
            <div>
              <span>Taxable value</span>
              <b>{formatMoney(gst.taxable)}</b>
            </div>
            {showCgst ? (
              <>
                <div>
                  <span>CGST</span>
                  <b>{formatMoney(gst.cgst)}</b>
                </div>
                <div>
                  <span>SGST</span>
                  <b>{formatMoney(gst.sgst)}</b>
                </div>
              </>
            ) : null}
            {showIgst ? (
              <div>
                <span>IGST</span>
                <b>{formatMoney(gst.igst)}</b>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="is-grand">
          <span>Grand total</span>
          <b>{formatMoney(data.total_amount)}</b>
        </div>
      </div>

      <footer className="invoice-bill-shop-foot">
        <p>
          {gst?.inclusive !== false
            ? "Prices inclusive of GST · Tax breakup shown above"
            : "Tax as applicable under GST"}
        </p>
        <p>Thank you for shopping at Vasritha</p>
        <p>Goods once sold are exchangeable with this bill as per store policy</p>
        <p className="invoice-bill-shop-code">{data.order_number}</p>
      </footer>
    </article>
  );
}
