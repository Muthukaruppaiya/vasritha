"use client";

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
};

type Props = {
  data: CourierLabelData;
  id?: string;
};

function formatStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

export function CourierLabel({ data, id = "tvs-l46-courier" }: Props) {
  const ship = data.shipping_address;
  const name = ship?.recipient_name || data.customer_name || "Customer";
  const phone = ship?.phone || data.customer_phone || "—";

  return (
    <article className="tvs-receipt tvs-courier" id={id}>
      <header className="tvs-receipt-brand">
        <img src="/vasritha-logo.svg" alt="Vasritha" className="tvs-receipt-logo" />
        <strong>VASRITHA</strong>
        <span>Timeless Elegance</span>
        <span className="tvs-receipt-store">COURIER / SHIPPING LABEL</span>
      </header>

      <div className="tvs-receipt-rule" aria-hidden="true">
        ----------------------------------------
      </div>

      <div className="tvs-courier-badge">SHIP TO</div>

      <div className="tvs-courier-to">
        <strong>{name}</strong>
        <p>Ph: {phone}</p>
        {data.customer_email ? <p>{data.customer_email}</p> : null}

        {ship ? (
          <div className="tvs-courier-address">
            <p>{ship.line1}</p>
            {ship.line2 ? <p>{ship.line2}</p> : null}
            <p>
              {ship.city}, {ship.state}
            </p>
            <p className="tvs-courier-pin">PIN {ship.postal_code}</p>
            <p>{ship.country}</p>
          </div>
        ) : (
          <div className="tvs-courier-address">
            <p className="tvs-courier-missing">No shipping address on file</p>
            <p>Contact customer before dispatch</p>
          </div>
        )}
      </div>

      <div className="tvs-receipt-rule" aria-hidden="true">
        ----------------------------------------
      </div>

      <div className="tvs-receipt-meta">
        <div>
          <span>Order</span>
          <b>{data.order_number}</b>
        </div>
        <div>
          <span>Placed</span>
          <b>{formatStamp(data.created_at)}</b>
        </div>
        <div>
          <span>Payment</span>
          <b>{data.payment_status.toUpperCase()}</b>
        </div>
        <div>
          <span>Status</span>
          <b>{data.status.toUpperCase()}</b>
        </div>
        <div>
          <span>Pieces</span>
          <b>{data.item_count}</b>
        </div>
      </div>

      <div className="tvs-receipt-rule" aria-hidden="true">
        ----------------------------------------
      </div>

      <div className="tvs-courier-from">
        <div className="tvs-courier-badge is-from">FROM</div>
        <strong>Vasritha Boutique</strong>
        <p>Handle with care · Fragile textiles</p>
        <p>Return to sender if undelivered</p>
      </div>

      <footer className="tvs-receipt-foot">
        <p className="tvs-receipt-code">{data.order_number}</p>
        <p className="tvs-receipt-printer">TVS LP 46 · Courier slip</p>
      </footer>
    </article>
  );
}
