"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "../../lib/admin-api";
import { barcodeDataUrl, qrDataUrl } from "../../lib/print-barcodes";

export type CourierAddress = {
  recipient_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  label?: string | null;
};

export type CourierSeller = {
  legal_name?: string | null;
  address?: string | null;
  gstin?: string | null;
  state?: string | null;
  state_code?: string | null;
  phone?: string | null;
  shop_code?: string | null;
};

export type CourierLabelData = {
  order_number: string;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  payment_status: string;
  status: string;
  total_amount: string | number;
  item_count: number;
  shipping_address: CourierAddress | null;
  seller?: CourierSeller | null;
};

type Props = {
  data: CourierLabelData;
  id?: string;
};

function formatStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function CourierLabel({ data, id = "vasritha-parcel-label" }: Props) {
  const ship = data.shipping_address;
  const seller = data.seller;
  const name = ship?.recipient_name || data.customer_name || "Customer";
  const phone = ship?.phone || data.customer_phone || "—";
  const isPrepaid = ["paid", "captured", "success"].includes(
    String(data.payment_status || "").toLowerCase()
  );
  const routeCode = `${ship?.postal_code || "000000"}-${seller?.state_code || "00"}`;
  const awb = `VSR${String(data.order_number).replace(/\D/g, "").slice(-10).padStart(10, "0")}`;

  const [barcodeSrc, setBarcodeSrc] = useState("");
  const [qrSrc, setQrSrc] = useState("");

  useEffect(() => {
    setBarcodeSrc(barcodeDataUrl(awb, 44, 1.5));
    void qrDataUrl(
      `${awb}|${data.order_number}|${ship?.postal_code || ""}`,
      92
    ).then(setQrSrc);
  }, [awb, data.order_number, ship?.postal_code]);

  return (
    <article className="parcel-label" id={id}>
      <header className="parcel-label-top">
        <div className="parcel-label-carrier">
          <strong>Vasritha Logistics</strong>
          <span>
            {seller?.shop_code || "VSR"} / {seller?.state_code || "IN"}
          </span>
          <span>{routeCode}</span>
        </div>
        <div className="parcel-label-pay">
          <span className={`parcel-label-badge${isPrepaid ? " is-prepaid" : " is-cod"}`}>
            {isPrepaid ? "Prepaid" : "COD"}
          </span>
          <b>{isPrepaid ? "Rs. 0.0" : formatMoney(data.total_amount)}</b>
          <span>NORMAL · Fwd</span>
        </div>
      </header>

      <div className="parcel-label-awb">
        {barcodeSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={barcodeSrc} alt="" />
        ) : null}
        <b>{awb}</b>
      </div>

      <div className="parcel-label-body">
        <section className="parcel-label-ship">
          <h2>Buyer&apos;s Name And Address</h2>
          <strong>{name}</strong>
          {ship ? (
            <p>
              {ship.line1}
              {ship.line2 ? `, ${ship.line2}` : ""}, {ship.city} {ship.postal_code} {ship.country}
            </p>
          ) : (
            <p>Address not on file — contact customer before dispatch</p>
          )}
          <p>Ph: {phone}</p>
          <p>Order: {data.order_number}</p>
          <p>
            Pieces: {data.item_count} · Placed: {formatStamp(data.created_at)}
          </p>
        </section>
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrSrc} alt="" className="parcel-label-qr" />
        ) : null}
      </div>

      <section className="parcel-label-return">
        <h3>If undelivered, please return to</h3>
        <strong>{seller?.legal_name || "Vasritha"}</strong>
        <p>{seller?.address || "Return to dispatch warehouse as per seller policy."}</p>
        {seller?.state ? (
          <p>
            {seller.state}
            {seller.state_code ? ` - ${seller.state_code}` : ""}
          </p>
        ) : null}
      </section>

      <section className="parcel-label-seller">
        <h3>Seller Details</h3>
        <p>
          <b>{seller?.legal_name || "Vasritha"}</b>
        </p>
        {seller?.gstin ? <p>GSTIN: {seller.gstin}</p> : null}
        {seller?.phone ? <p>Ph: {seller.phone}</p> : null}
      </section>

      <footer className="parcel-label-foot">
        <p>
          Buyer declaration: {name} declares that the goods in this shipment are for personal use
          and not for resale.
        </p>
        <div className="parcel-label-brand">
          <span>Purchase made at</span>
          <strong>vasritha.in</strong>
        </div>
      </footer>
    </article>
  );
}
