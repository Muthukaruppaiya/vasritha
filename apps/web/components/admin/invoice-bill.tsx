"use client";

import { formatDate, formatMoney } from "../../lib/admin-api";
import type { ThermalReceiptData, ThermalReceiptItem } from "./thermal-receipt";
import { TaxInvoiceA4 } from "./tax-invoice-a4";

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
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function clip(value: string, max: number) {
  const clean = String(value || "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

/** GST bill: A4 tax invoice for online orders; 3″ (80mm) thermal roll for POS. */
export function InvoiceBill({ data, id = "vasritha-invoice-bill" }: Props) {
  if (data.channel === "online") {
    return <TaxInvoiceA4 data={data} id={id} />;
  }

  const isPos = data.channel === "pos";
  const discount = Number(data.discount_amount || 0);
  const shipping = Number(data.shipping_amount || 0);
  const lines = Array.isArray(data.items) ? data.items : [];
  const seller = data.seller;
  const hasGstin = Boolean(seller?.gstin);
  const gst = data.gst;
  const showCgst = Boolean(gst && (gst.cgst > 0 || gst.sgst > 0));
  const showIgst = Boolean(gst && gst.igst > 0);

  const storeName = seller?.shop_name || seller?.legal_name || "VASRITHA";
  const storeAddress = seller?.address?.trim() || null;
  const placeOfSupply = seller?.state || null;
  const stateCode = seller?.state_code || null;
  const customerName = data.customer_name?.trim() || (isPos ? "Walk-in" : "Customer");
  const customerPhone = data.customer_phone?.replace(/\D/g, "").slice(-10) || null;
  const cashierName = data.cashier_name?.trim() || null;

  return (
    <article className="invoice-bill invoice-bill--shop" id={id}>
      <header className="invoice-bill-shop-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/vasritha-logo-circle.png"
          alt=""
          className="invoice-bill-logo"
        />
        <div className="invoice-bill-shop-title">
          <strong>{storeName}</strong>
          {storeAddress ? <span className="invoice-bill-shop-address">{storeAddress}</span> : null}
          {seller?.phone ? <span>Ph: {seller.phone}</span> : null}
          {seller?.gstin ? <span>GSTIN: {seller.gstin}</span> : null}
          <em>{hasGstin || isPos ? "Tax Invoice" : "Order Bill"}</em>
        </div>
      </header>

      <div className="invoice-bill-shop-meta invoice-bill-shop-meta--compact">
        <p>BillNo : {data.order_number}</p>
        <p>Date : {formatReceiptDate(data.created_at)}</p>
        {placeOfSupply || stateCode ? (
          <p>
            Place of Supply : {placeOfSupply || "—"}
            {stateCode ? ` & ${stateCode}` : ""}
          </p>
        ) : null}
        {cashierName ? <p>Cashier : {cashierName}</p> : null}
        <p>Customer : {customerName}</p>
        {customerPhone ? <p>Mobile No : {customerPhone}</p> : null}
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
            <th className="is-item">
              Code
              <small>HSN / Tax</small>
            </th>
            <th className="is-qty">Qty</th>
            <th className="is-rate">Rate</th>
            <th className="is-amt">Amt</th>
          </tr>
        </thead>
        <tbody>
          {lines.length ? (
            lines.map((item, index) => {
              const code = item.sku || "—";
              const hsn = item.hsn_code || "";
              const rate =
                item.gst_rate != null && item.gst_rate !== ""
                  ? `GST${Number(item.gst_rate)}%`
                  : "";
              const meta = [hsn ? `HSN ${hsn}` : "", rate].filter(Boolean).join(" · ");

              return (
                <tr key={`${item.product_id}-${index}`}>
                  <td className="is-item">
                    <b>{clip(code, 28)}</b>
                    {meta ? <span>{clip(meta, 32)}</span> : null}
                  </td>
                  <td className="is-qty">{item.quantity}</td>
                  <td className="is-rate">{formatMoney(item.unit_price)}</td>
                  <td className="is-amt">{formatMoney(item.line_total)}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={4}>No items</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="invoice-bill-shop-totals">
        <div>
          <span>Amount</span>
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
          <div>
            <span>Taxable</span>
            <b>{formatMoney(gst.taxable)}</b>
          </div>
        ) : null}
        {gst && showCgst ? (
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
        {gst && showIgst ? (
          <div>
            <span>IGST</span>
            <b>{formatMoney(gst.igst)}</b>
          </div>
        ) : null}
        <div className="is-grand">
          <span>Total Amt</span>
          <b>{formatMoney(data.total_amount)}</b>
        </div>
        {(() => {
          const paid = Number(data.amount_paid);
          const due = Number(data.balance_due);
          const showCredit =
            data.payment_status !== "paid" ||
            (Number.isFinite(due) && due > 0.009) ||
            (Number.isFinite(paid) && paid + 0.009 < Number(data.total_amount));
          if (!showCredit || (!Number.isFinite(paid) && !Number.isFinite(due))) return null;
          const paidAmt = Number.isFinite(paid)
            ? paid
            : Math.max(0, Number(data.total_amount) - (Number.isFinite(due) ? due : 0));
          const dueAmt = Number.isFinite(due)
            ? due
            : Math.max(0, Number(data.total_amount) - paidAmt);
          if (dueAmt <= 0.009 && data.payment_status === "paid") return null;
          return (
            <>
              <div>
                <span>Paid now</span>
                <b>{formatMoney(paidAmt)}</b>
              </div>
              <div className="is-grand">
                <span>Balance due</span>
                <b>{formatMoney(dueAmt)}</b>
              </div>
            </>
          );
        })()}
      </div>

      <footer className="invoice-bill-shop-foot">
        <p>1. Goods once sold are exchangeable with this bill as per store policy.</p>
        <p>2. No cash refunds. Exchange only at the store.</p>
        {Number(data.balance_due) > 0.009 || data.payment_status !== "paid" ? (
          <p>3. Balance due as noted above — settle at the store.</p>
        ) : null}
      </footer>
    </article>
  );
}
