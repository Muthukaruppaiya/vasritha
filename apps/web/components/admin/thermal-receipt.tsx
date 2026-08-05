"use client";

import { formatDate, formatMoney } from "../../lib/admin-api";

export type ThermalReceiptItem = {
  product_id: string;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type ThermalReceiptData = {
  order_number: string;
  created_at: string;
  subtotal: string | number;
  discount_amount?: string | number;
  tax_amount?: string | number;
  shipping_amount?: string | number;
  total_amount: string | number;
  payment_status: string;
  status: string;
  channel: "pos" | "online" | string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  shipping_address?: {
    recipient_name: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  } | null;
  items: ThermalReceiptItem[];
};

type Props = {
  data: ThermalReceiptData;
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

export function ThermalReceipt({ data, id = "tvs-l46-receipt" }: Props) {
  const isPos = data.channel === "pos";
  const discount = Number(data.discount_amount || 0);
  const tax = Number(data.tax_amount || 0);
  const shipping = Number(data.shipping_amount || 0);
  const itemCount = data.items.reduce((sum, item) => sum + Number(item.quantity), 0);

  return (
    <article className="tvs-receipt" id={id}>
      <header className="tvs-receipt-brand">
        <img src="/vasritha-logo.svg" alt="Vasritha" className="tvs-receipt-logo" />
        <strong>VASRITHA</strong>
        <span>Timeless Elegance</span>
        <span className="tvs-receipt-store">
          {isPos ? "Physical Store · Counter Bill" : "Online Order Invoice"}
        </span>
      </header>

      <div className="tvs-receipt-rule" aria-hidden="true">
        ----------------------------------------
      </div>

      <div className="tvs-receipt-title">TAX INVOICE</div>
      <div className="tvs-receipt-meta">
        <div>
          <span>Invoice</span>
          <b>INV-{data.order_number}</b>
        </div>
        <div>
          <span>Date</span>
          <b>{formatReceiptDate(data.created_at)}</b>
        </div>
        <div>
          <span>Bill type</span>
          <b>{isPos ? "Store POS" : "Online"}</b>
        </div>
        <div>
          <span>Payment</span>
          <b>{data.payment_status.toUpperCase()}</b>
        </div>
        {!isPos && data.customer_name ? (
          <div>
            <span>Customer</span>
            <b>{data.customer_name}</b>
          </div>
        ) : null}
        {!isPos && data.customer_phone ? (
          <div>
            <span>Phone</span>
            <b>{data.customer_phone}</b>
          </div>
        ) : null}
        {!isPos && data.customer_email ? (
          <div>
            <span>Email</span>
            <b>{data.customer_email}</b>
          </div>
        ) : null}
        {isPos ? (
          <div>
            <span>Customer</span>
            <b>Walk-in</b>
          </div>
        ) : null}
      </div>

      {!isPos && data.shipping_address ? (
        <>
          <div className="tvs-receipt-rule" aria-hidden="true">
            ----------------------------------------
          </div>
          <div className="tvs-receipt-ship">
            <div className="tvs-courier-badge">DELIVER TO</div>
            <b>{data.shipping_address.recipient_name}</b>
            <p>Ph: {data.shipping_address.phone}</p>
            <p>{data.shipping_address.line1}</p>
            {data.shipping_address.line2 ? <p>{data.shipping_address.line2}</p> : null}
            <p>
              {data.shipping_address.city}, {data.shipping_address.state}{" "}
              {data.shipping_address.postal_code}
            </p>
            <p>{data.shipping_address.country}</p>
          </div>
        </>
      ) : null}

      <div className="tvs-receipt-rule" aria-hidden="true">
        ----------------------------------------
      </div>

      <table className="tvs-receipt-items">
        <thead>
          <tr>
            <th className="is-item">Item</th>
            <th className="is-qty">Qty</th>
            <th className="is-amt">Amt</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => (
            <tr key={`${item.product_id}-${index}`}>
              <td className="is-item">
                <b>
                  {item.product_name}
                  {item.variant_name ? ` (${item.variant_name})` : ""}
                </b>
                <span>
                  {item.sku ? `${item.sku} · ` : ""}
                  {formatMoney(item.unit_price)} × {item.quantity}
                </span>
              </td>
              <td className="is-qty">{item.quantity}</td>
              <td className="is-amt">{formatMoney(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="tvs-receipt-rule" aria-hidden="true">
        ----------------------------------------
      </div>

      <div className="tvs-receipt-totals">
        <div>
          <span>Items</span>
          <b>{itemCount}</b>
        </div>
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
        {!isPos && tax > 0 ? (
          <div>
            <span>Tax</span>
            <b>{formatMoney(tax)}</b>
          </div>
        ) : null}
        <div className="is-grand">
          <span>TOTAL</span>
          <b>{formatMoney(data.total_amount)}</b>
        </div>
      </div>

      <div className="tvs-receipt-rule" aria-hidden="true">
        ----------------------------------------
      </div>

      <footer className="tvs-receipt-foot">
        <p>Status: {data.status}</p>
        <p>Thank you for shopping at Vasritha</p>
        <p>Please retain this bill for exchange</p>
        <p className="tvs-receipt-code">{data.order_number}</p>
        <p className="tvs-receipt-printer">TVS LP 46 · 108mm</p>
      </footer>
    </article>
  );
}
