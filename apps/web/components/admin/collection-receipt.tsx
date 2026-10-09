"use client";

import { formatDate, formatMoney } from "../../lib/admin-api";

export type CollectionReceiptData = {
  order_number: string;
  collected_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  invoice_amount: number;
  collected: number;
  paid_amount: number;
  balance_due: number;
  fully_paid: boolean;
  method: "cash" | "upi" | "card" | string;
  seller?: {
    legal_name?: string | null;
    shop_name?: string | null;
    address?: string | null;
    phone?: string | null;
    gstin?: string | null;
  } | null;
};

type Props = {
  data: CollectionReceiptData;
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

function methodLabel(method: string) {
  const value = String(method || "cash").toLowerCase();
  if (value === "upi") return "UPI";
  if (value === "card") return "Card";
  return "Cash";
}

/** 80mm thermal receipt for credit collection / part payment. */
export function CollectionReceipt({ data, id = "dues-collection-print" }: Props) {
  const storeName = data.seller?.shop_name || data.seller?.legal_name || "VASRITHA";
  const customerName = data.customer_name?.trim() || "Walk-in";
  const customerPhone = data.customer_phone?.replace(/\D/g, "").slice(-10) || null;

  return (
    <article className="invoice-bill invoice-bill--shop collection-receipt" id={id}>
      <header className="invoice-bill-shop-head">
        <div className="invoice-bill-shop-title">
          <strong>{storeName}</strong>
          {data.seller?.address ? (
            <span className="invoice-bill-shop-address">{data.seller.address}</span>
          ) : null}
          {data.seller?.phone ? <span>Ph: {data.seller.phone}</span> : null}
          {data.seller?.gstin ? <span>GSTIN: {data.seller.gstin}</span> : null}
          <em>Payment Receipt</em>
        </div>
      </header>

      <div className="invoice-bill-shop-meta invoice-bill-shop-meta--compact">
        <p>BillNo : {data.order_number}</p>
        <p>Date : {formatReceiptDate(data.collected_at)}</p>
        <p>Customer : {customerName}</p>
        {customerPhone ? <p>Mobile No : {customerPhone}</p> : null}
        <p>Mode : {methodLabel(data.method)}</p>
      </div>

      <table className="invoice-bill-table invoice-bill-table--shop">
        <tbody>
          <tr>
            <td className="is-item">Invoice total</td>
            <td className="is-amt" colSpan={3}>
              {formatMoney(data.invoice_amount)}
            </td>
          </tr>
          <tr>
            <td className="is-item">
              <strong>Collected now</strong>
            </td>
            <td className="is-amt" colSpan={3}>
              <strong>{formatMoney(data.collected)}</strong>
            </td>
          </tr>
          <tr>
            <td className="is-item">Paid till date</td>
            <td className="is-amt" colSpan={3}>
              {formatMoney(data.paid_amount)}
            </td>
          </tr>
          <tr>
            <td className="is-item">
              <strong>{data.fully_paid ? "Balance" : "Remaining due"}</strong>
            </td>
            <td className="is-amt" colSpan={3}>
              <strong>{formatMoney(data.balance_due)}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="invoice-bill-shop-totals">
        <div>
          <span>Collected now</span>
          <b>{formatMoney(data.collected)}</b>
        </div>
        <div className="is-grand">
          <span>{data.fully_paid ? "Status" : "Remaining due"}</span>
          <b>{data.fully_paid ? "FULLY PAID" : formatMoney(data.balance_due)}</b>
        </div>
      </div>

      <footer className="invoice-bill-shop-foot">
        <p>{data.fully_paid ? "Thank you — bill settled." : "Thank you — balance still due."}</p>
      </footer>
    </article>
  );
}
