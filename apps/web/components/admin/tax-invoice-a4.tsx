"use client";

import { useEffect, useState } from "react";
import { formatDate, formatMoney } from "../../lib/admin-api";
import { splitInclusiveGst } from "../../lib/gst-math";
import type { InvoiceBillData } from "./invoice-bill";
import { barcodeDataUrl, qrDataUrl } from "../../lib/print-barcodes";

type Props = {
  data: InvoiceBillData;
  id?: string;
};

type LineBreakup = {
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  hsn_code: string | null;
  gst_rate: number;
  quantity: number;
  gross: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
};

function formatInvoiceDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildLineBreakup(data: InvoiceBillData, interState: boolean): LineBreakup[] {
  const lines = data.items || [];
  const subtotal = lines.reduce((sum, line) => sum + Number(line.line_total || 0), 0);
  const orderDiscount = Math.min(subtotal, Math.max(0, Number(data.discount_amount || 0)));

  return lines.map((line) => {
    const gross = round2(Number(line.unit_price) * Number(line.quantity));
    const share = subtotal > 0 ? Number(line.line_total || 0) / subtotal : 0;
    const discount = round2(orderDiscount * share);
    const net = round2(Number(line.line_total || 0) - discount);
    const split = splitInclusiveGst(net, Number(line.gst_rate || 5));
    return {
      product_name: line.product_name,
      variant_name: line.variant_name,
      sku: line.sku,
      hsn_code: line.hsn_code || null,
      gst_rate: Number(line.gst_rate || 5),
      quantity: Number(line.quantity),
      gross,
      discount,
      taxable: split.taxable,
      cgst: interState ? 0 : split.cgst,
      sgst: interState ? 0 : split.sgst,
      igst: interState ? split.gst : 0,
      total: net
    };
  });
}

export function TaxInvoiceA4({ data, id = "vasritha-tax-invoice-a4" }: Props) {
  const seller = data.seller;
  const ship = data.shipping_address;
  const gst = data.gst;
  const interState = Boolean(gst && gst.igst > 0);
  const lines = buildLineBreakup(data, interState);
  const totals = lines.reduce(
    (acc, line) => ({
      gross: acc.gross + line.gross,
      discount: acc.discount + line.discount,
      taxable: acc.taxable + line.taxable,
      cgst: acc.cgst + line.cgst,
      sgst: acc.sgst + line.sgst,
      igst: acc.igst + line.igst,
      total: acc.total + line.total
    }),
    { gross: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  );
  const shipping = Number(data.shipping_amount || 0);
  const grandTotal = round2(totals.total + shipping);
  const placeOfSupply = ship?.state || seller?.state || "—";
  const natureOfTxn = interState ? "Inter-State" : "Intra-State";
  const isPrepaid = ["paid", "captured", "success"].includes(
    String(data.payment_status || "").toLowerCase()
  );

  const [barcodeSrc, setBarcodeSrc] = useState("");
  const [qrSrc, setQrSrc] = useState("");

  useEffect(() => {
    const packetId = `PKT-${data.order_number}`;
    setBarcodeSrc(barcodeDataUrl(packetId, 52, 1.6));
    void qrDataUrl(
      `INV-${data.order_number}|${grandTotal}|${seller?.gstin || ""}`,
      88
    ).then(setQrSrc);
  }, [data.order_number, grandTotal, seller?.gstin]);

  return (
    <article className="tax-invoice-a4" id={id}>
      <header className="tax-invoice-a4-head">
        <div>
          <h1>Tax Invoice</h1>
          <p className="tax-invoice-a4-brand">{seller?.legal_name || "VASRITHA"}</p>
        </div>
        <div className="tax-invoice-a4-packet">
          {barcodeSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={barcodeSrc} alt="" className="tax-invoice-a4-barcode" />
          ) : null}
          <div>
            <span>Packet ID</span>
            <b>PKT-{data.order_number}</b>
          </div>
        </div>
      </header>

      <div className="tax-invoice-a4-meta">
        <div>
          <span>Invoice Number</span>
          <b>INV-{data.order_number}</b>
        </div>
        <div>
          <span>Order Number</span>
          <b>{data.order_number}</b>
        </div>
        <div>
          <span>Invoice Date</span>
          <b>{formatInvoiceDate(data.created_at)}</b>
        </div>
        <div>
          <span>Order Date</span>
          <b>{formatInvoiceDate(data.created_at)}</b>
        </div>
        <div>
          <span>Nature of Transaction</span>
          <b>{natureOfTxn}</b>
        </div>
        <div>
          <span>Place of Supply</span>
          <b>{placeOfSupply.toUpperCase()}</b>
        </div>
        <div>
          <span>Nature of Supply</span>
          <b>Goods</b>
        </div>
        <div>
          <span>Payment</span>
          <b>{isPrepaid ? "Prepaid" : data.payment_status.toUpperCase()}</b>
        </div>
      </div>

      <div className="tax-invoice-a4-parties">
        <section>
          <h2>Bill to / Ship to</h2>
          <b>{ship?.recipient_name || data.customer_name || "Customer"}</b>
          {ship ? (
            <>
              <p>
                {ship.line1}
                {ship.line2 ? `, ${ship.line2}` : ""}
              </p>
              <p>
                {ship.city}, {ship.state} - {ship.postal_code}, {ship.country}
              </p>
              <p>Ph: {ship.phone}</p>
            </>
          ) : (
            <p>{data.customer_phone || data.customer_email || "—"}</p>
          )}
          <p className="tax-invoice-a4-muted">Customer Type: Unregistered</p>
        </section>
        <section>
          <h2>Bill from / Ship from</h2>
          <b>{seller?.legal_name || "VASRITHA"}</b>
          {seller?.address ? <p>{seller.address}</p> : null}
          {seller?.state ? (
            <p>
              {seller.state}
              {seller.state_code ? ` (${seller.state_code})` : ""}
            </p>
          ) : null}
          {seller?.gstin ? (
            <p>
              <b>GSTIN:</b> {seller.gstin}
            </p>
          ) : null}
          {seller?.phone ? <p>Ph: {seller.phone}</p> : null}
        </section>
      </div>

      <table className="tax-invoice-a4-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>HSN</th>
            <th>Qty</th>
            <th>Gross</th>
            <th>Discount</th>
            <th>Other</th>
            <th>Taxable</th>
            <th>CGST</th>
            <th>SGST / UGST</th>
            <th>IGST</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.sku || line.product_name}-${index}`}>
              <td className="is-desc">
                <b>
                  {line.product_name}
                  {line.variant_name ? ` · ${line.variant_name}` : ""}
                </b>
                <span>
                  {line.sku || ""}
                  {line.gst_rate ? ` · GST ${line.gst_rate}%` : ""}
                </span>
              </td>
              <td>{line.hsn_code || "—"}</td>
              <td>{line.quantity}</td>
              <td>{formatMoney(line.gross)}</td>
              <td>{line.discount > 0 ? formatMoney(line.discount) : "—"}</td>
              <td>—</td>
              <td>{formatMoney(line.taxable)}</td>
              <td>{line.cgst > 0 ? formatMoney(line.cgst) : "—"}</td>
              <td>{line.sgst > 0 ? formatMoney(line.sgst) : "—"}</td>
              <td>{line.igst > 0 ? formatMoney(line.igst) : "—"}</td>
              <td>{formatMoney(line.total)}</td>
            </tr>
          ))}
          <tr className="is-total">
            <td colSpan={2}>
              <b>TOTAL</b>
            </td>
            <td>{lines.reduce((sum, line) => sum + line.quantity, 0)}</td>
            <td>{formatMoney(totals.gross)}</td>
            <td>{totals.discount > 0 ? formatMoney(totals.discount) : "—"}</td>
            <td>{shipping > 0 ? formatMoney(shipping) : "—"}</td>
            <td>{formatMoney(totals.taxable)}</td>
            <td>{totals.cgst > 0 ? formatMoney(totals.cgst) : "—"}</td>
            <td>{totals.sgst > 0 ? formatMoney(totals.sgst) : "—"}</td>
            <td>{totals.igst > 0 ? formatMoney(totals.igst) : "—"}</td>
            <td>
              <b>{formatMoney(grandTotal)}</b>
            </td>
          </tr>
        </tbody>
      </table>

      <footer className="tax-invoice-a4-foot">
        <div>
          <strong>{seller?.legal_name || "VASRITHA"}</strong>
          <p>Authorized Signatory</p>
          <p className="tax-invoice-a4-muted">
            {gst?.inclusive !== false
              ? "Amounts are GST-inclusive unless stated otherwise."
              : "Tax as applicable under GST."}
          </p>
          {data.loyalty_prompt ? <p>{data.loyalty_prompt}</p> : null}
        </div>
        <div className="tax-invoice-a4-qr-wrap">
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrSrc} alt="" className="tax-invoice-a4-qr" />
          ) : null}
          <p>vasritha.in</p>
        </div>
      </footer>
    </article>
  );
}
