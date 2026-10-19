"use client";

import { formatDate, formatMoney } from "../../lib/admin-api";
import type { ShiftSummary } from "../../lib/pos-shifts";

export type ShiftHandoverReceiptData = {
  shop_name?: string | null;
  company_name?: string | null;
  opener_name: string;
  opener_code?: string | null;
  handover_name?: string | null;
  opened_at: string;
  closed_at: string;
  opening_float: number;
  closing_cash_counted?: number | null;
  expected_cash: number;
  summary: ShiftSummary;
  notes?: string | null;
};

type Props = {
  data: ShiftHandoverReceiptData;
  id?: string;
};

function fmtWhen(value: string) {
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

/** 80mm thermal handover / day-close slip for POS staff. */
export function ShiftHandoverReceipt({
  data,
  id = "shift-handover-print"
}: Props) {
  const store = data.shop_name || data.company_name || "VASRITHA";
  const s = data.summary;
  const cashDiff =
    data.closing_cash_counted != null
      ? Math.round((data.closing_cash_counted - data.expected_cash) * 100) / 100
      : null;

  return (
    <article className="invoice-bill invoice-bill--shop collection-receipt" id={id}>
      <header className="invoice-bill-shop-head">
        <div className="invoice-bill-shop-title">
          <strong>{store}</strong>
          <em>Shift Handover</em>
        </div>
      </header>

      <div className="invoice-bill-shop-meta invoice-bill-shop-meta--compact">
        <p>Staff : {data.opener_name}</p>
        {data.opener_code ? <p>Id : {data.opener_code}</p> : null}
        <p>From : {fmtWhen(data.opened_at)}</p>
        <p>To : {fmtWhen(data.closed_at)}</p>
        {data.handover_name ? <p>Handover to : {data.handover_name}</p> : null}
      </div>

      <table className="invoice-bill-table invoice-bill-table--shop">
        <tbody>
          <tr>
            <td>Bills</td>
            <td className="is-amt">{s.bill_count}</td>
          </tr>
          <tr>
            <td>Items sold</td>
            <td className="is-amt">{s.items_sold}</td>
          </tr>
          <tr>
            <td>Sales total</td>
            <td className="is-amt">{formatMoney(s.sales_total)}</td>
          </tr>
          <tr>
            <td>Discount</td>
            <td className="is-amt">{formatMoney(s.discount_total)}</td>
          </tr>
          <tr>
            <td>Cash collected</td>
            <td className="is-amt">{formatMoney(s.cash_total)}</td>
          </tr>
          <tr>
            <td>UPI</td>
            <td className="is-amt">{formatMoney(s.upi_total)}</td>
          </tr>
          <tr>
            <td>Card</td>
            <td className="is-amt">{formatMoney(s.card_total)}</td>
          </tr>
          <tr>
            <td>Razorpay</td>
            <td className="is-amt">{formatMoney(s.razorpay_total)}</td>
          </tr>
          <tr>
            <td>Credit due</td>
            <td className="is-amt">{formatMoney(s.balance_due_total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="invoice-bill-shop-meta invoice-bill-shop-meta--compact">
        <p>Opening float : {formatMoney(data.opening_float)}</p>
        <p>Expected cash : {formatMoney(data.expected_cash)}</p>
        {data.closing_cash_counted != null ? (
          <p>Counted cash : {formatMoney(data.closing_cash_counted)}</p>
        ) : null}
        {cashDiff != null ? (
          <p>
            Difference : {cashDiff >= 0 ? "+" : ""}
            {formatMoney(cashDiff)}
          </p>
        ) : null}
      </div>

      {data.notes ? (
        <p className="collection-receipt-note">Note: {data.notes}</p>
      ) : null}

      <footer className="invoice-bill-shop-foot">
        <p>Staff sign _____________</p>
        <p>Receiver sign _____________</p>
        <p className="muted">Printed {fmtWhen(new Date().toISOString())}</p>
      </footer>
    </article>
  );
}
