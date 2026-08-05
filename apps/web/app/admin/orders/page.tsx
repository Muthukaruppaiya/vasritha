"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  Check,
  ChevronRight,
  Eye,
  Globe,
  MapPin,
  Package,
  Phone,
  Printer,
  Truck,
  UserRound,
  X
} from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "../../../components/admin/admin-ui";
import { CourierLabel } from "../../../components/admin/courier-label";
import { ThermalReceipt } from "../../../components/admin/thermal-receipt";
import { adminFetch, formatDate, formatMoney } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type Order = {
  id: string;
  order_number: string;
  customer_id: string;
  status: string;
  payment_status: string;
  subtotal: string;
  discount_amount?: string;
  tax_amount: string;
  shipping_amount: string;
  total_amount: string;
  channel?: string;
  created_at: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
};

type ShippingAddress = {
  recipient_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  label?: string | null;
};

type OrderDetail = Order & {
  shipping_address: ShippingAddress | null;
  payment?: {
    provider: string;
    provider_payment_id: string | null;
    amount: string;
    status: string;
  } | null;
  items: Array<{
    product_id: string;
    product_name: string;
    variant_name: string | null;
    sku: string | null;
    unit_price: number;
    quantity: number;
    line_total: number;
  }>;
};

type PrintMode = "invoice" | "courier" | "both";
type DeskTab = "details" | "invoice" | "courier";

const PIPELINE = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Packing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" }
] as const;

const STATUS_CHIPS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Packing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" }
];

const NEXT_ACTION: Record<string, { next: string; label: string; hint: string } | null> = {
  pending: {
    next: "confirmed",
    label: "Confirm order",
    hint: "Payment checked — move to packing queue"
  },
  confirmed: {
    next: "processing",
    label: "Start packing",
    hint: "Pick items, then print invoice + courier label"
  },
  processing: {
    next: "shipped",
    label: "Mark shipped",
    hint: "Print courier label, then hand over to courier"
  },
  shipped: {
    next: "delivered",
    label: "Mark delivered",
    hint: "Customer received the parcel"
  },
  delivered: null,
  cancelled: null
};

function pipelineIndex(status: string) {
  return PIPELINE.findIndex((step) => step.key === status);
}

function statusLabel(status: string) {
  if (status === "processing") return "Packing";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function AdminOrdersPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>("both");
  const [deskTab, setDeskTab] = useState<DeskTab>("details");

  const { data, error, loading, reload } = useAdminQuery<Order[]>(
    "/api/admin/orders?channel=online"
  );

  const counts = useMemo(() => {
    const rows = data || [];
    return {
      all: rows.filter((row) => row.status !== "cancelled").length,
      pending: rows.filter((row) => row.status === "pending").length,
      packing: rows.filter(
        (row) => row.status === "processing" || row.status === "confirmed"
      ).length,
      shipped: rows.filter((row) => row.status === "shipped").length
    };
  }, [data]);

  const queue = useMemo(() => {
    const rows = data || [];
    if (!statusFilter) return rows.filter((row) => row.status !== "cancelled");
    return rows.filter((row) => row.status === statusFilter);
  }, [data, statusFilter]);

  const closeModal = () => {
    setSelected(null);
    setDetailError("");
  };

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [selected]);

  const updateStatus = async (orderId: string, status: string, announce?: string) => {
    setUpdatingId(orderId);
    setDetailError("");
    setStatusMessage("");
    const result = await adminFetch("/api/admin/orders", {
      method: "PATCH",
      json: { orderId, status }
    });
    setUpdatingId(null);
    if (result.error) {
      setDetailError(result.error);
      return false;
    }
    await reload();
    if (selected?.id === orderId) {
      setSelected((prev) => (prev ? { ...prev, status } : prev));
    }
    setStatusMessage(announce || `Status updated to ${statusLabel(status)}.`);
    return true;
  };

  const advanceStatus = async (order: Pick<Order, "id" | "status" | "order_number">) => {
    const action = NEXT_ACTION[order.status];
    if (!action) return;
    const ok = await updateStatus(
      order.id,
      action.next,
      `${order.order_number} → ${statusLabel(action.next)}`
    );
    if (!ok) return;
    if (action.next === "processing") setDeskTab("invoice");
    if (action.next === "shipped") setDeskTab("courier");
  };

  const openDetail = async (orderId: string) => {
    setDetailError("");
    setStatusMessage("");
    setLoadingDetail(true);
    setDeskTab("details");
    setSelected(null);
    const result = await adminFetch<OrderDetail>(`/api/admin/orders/${orderId}`);
    setLoadingDetail(false);
    if (result.error || !result.data) {
      setDetailError(result.error || "Could not load order");
      return;
    }
    setSelected(result.data);
  };

  const printSlips = (mode: PrintMode) => {
    setPrintMode(mode);
    if (mode === "invoice") setDeskTab("invoice");
    if (mode === "courier") setDeskTab("courier");
    window.setTimeout(() => window.print(), 80);
  };

  const itemCount = selected
    ? selected.items.reduce((sum, item) => sum + Number(item.quantity), 0)
    : 0;
  const selectedAction = selected ? NEXT_ACTION[selected.status] : null;
  const selectedStep = selected ? pipelineIndex(selected.status) : -1;

  return (
    <>
      <AdminPageHeader
        title="Online Orders"
        description="Open an order popup to confirm, pack, print TVS LP 46 slips, and ship. Store counter sales stay on Store POS."
      />

      <div className="pos-channel-banner is-online">
        <Globe size={16} />
        <span>Online storefront sales</span>
        <em>Click an order → update status → print invoice & courier label.</em>
      </div>

      <div className="orders-stats">
        <article>
          <span>Active queue</span>
          <strong>{counts.all}</strong>
        </article>
        <article>
          <span>Pending</span>
          <strong>{counts.pending}</strong>
        </article>
        <article>
          <span>To pack / confirm</span>
          <strong>{counts.packing}</strong>
        </article>
        <article>
          <span>In transit</span>
          <strong>{counts.shipped}</strong>
        </article>
      </div>

      <div className="orders-filters">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value || "all"}
            type="button"
            className={statusFilter === chip.value ? "is-active" : ""}
            onClick={() => setStatusFilter(chip.value)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {detailError && !selected ? <AdminAlert>{detailError}</AdminAlert> : null}
      {statusMessage ? (
        <div className="orders-status-toast">
          <Check size={14} />
          {statusMessage}
        </div>
      ) : null}

      <AdminPanel title="Order queue">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !queue.length && (
          <AdminEmpty
            title="No orders in this view"
            body="Try another status filter, or wait for new website checkouts."
          />
        )}
        {queue.length > 0 && (
          <div className="orders-queue-list">
            <div className="orders-queue-list-head" aria-hidden="true">
              <span>Order</span>
              <span>Customer</span>
              <span>Payment</span>
              <span>Status</span>
              <span>Total</span>
              <span>Action</span>
            </div>
            {queue.map((order) => {
              const action = NEXT_ACTION[order.status];
              return (
                <article key={order.id} className="orders-queue-row">
                  <div className="orders-queue-col-order">
                    <strong>{order.order_number}</strong>
                    <p>{formatDate(order.created_at)}</p>
                  </div>
                  <div className="orders-queue-col-customer">
                    <span>{order.customer_name || "Customer"}</span>
                    <p>{order.customer_phone || order.customer_email || "—"}</p>
                  </div>
                  <div className="orders-queue-col-badge">
                    <AdminBadge tone={statusTone(order.payment_status)}>
                      {order.payment_status}
                    </AdminBadge>
                  </div>
                  <div className="orders-queue-col-badge">
                    <AdminBadge tone={statusTone(order.status)}>
                      {statusLabel(order.status)}
                    </AdminBadge>
                  </div>
                  <div className="orders-queue-col-total">
                    <b>{formatMoney(order.total_amount)}</b>
                  </div>
                  <div className="orders-queue-col-actions">
                    <button
                      type="button"
                      className="orders-queue-row-open"
                      onClick={() => void openDetail(order.id)}
                    >
                      <Eye size={14} />
                      Open
                    </button>
                    {action ? (
                      <button
                        type="button"
                        className="orders-queue-row-next"
                        disabled={updatingId === order.id || loadingDetail}
                        onClick={() => void advanceStatus(order)}
                      >
                        {updatingId === order.id ? "…" : action.label}
                        <ChevronRight size={14} />
                      </button>
                    ) : (
                      <span className="orders-queue-row-done muted">Complete</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </AdminPanel>

      {loadingDetail && (
        <div className="orders-modal-backdrop" role="status">
          <div className="orders-modal orders-modal--loading">
            <AdminLoading />
            <p className="muted">Opening order…</p>
          </div>
        </div>
      )}

      {selected && !loadingDetail && (
        <div
          className="orders-modal-backdrop"
          role="presentation"
          onClick={closeModal}
        >
          <div
            className="orders-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="orders-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="orders-modal-head">
              <div>
                <p className="eyebrow">Fulfilment popup</p>
                <h2 id="orders-modal-title">{selected.order_number}</h2>
                <p className="muted">{formatDate(selected.created_at)}</p>
              </div>
              <div className="orders-modal-head-right">
                <div className="orders-desk-total">
                  <span>Payable</span>
                  <strong>{formatMoney(selected.total_amount)}</strong>
                </div>
                <button
                  type="button"
                  className="orders-modal-close"
                  aria-label="Close"
                  onClick={closeModal}
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            {detailError ? <AdminAlert>{detailError}</AdminAlert> : null}

            <section className="orders-pipeline orders-pipeline--modal">
              <div className="orders-pipeline-track">
                {PIPELINE.map((step, index) => {
                  const done = selectedStep > index;
                  const current = selectedStep === index;
                  return (
                    <div
                      key={step.key}
                      className={`orders-pipeline-step${done ? " is-done" : ""}${
                        current ? " is-current" : ""
                      }`}
                    >
                      <span className="orders-pipeline-dot">
                        {done ? <Check size={12} /> : index + 1}
                      </span>
                      <span className="orders-pipeline-label">{step.label}</span>
                    </div>
                  );
                })}
              </div>
              {selectedAction ? (
                <p className="orders-pipeline-hint muted">{selectedAction.hint}</p>
              ) : (
                <p className="orders-pipeline-hint muted">
                  {selected.status === "cancelled"
                    ? "This order was cancelled."
                    : "Order delivered — fulfilment complete."}
                </p>
              )}
              <div className="orders-pipeline-actions orders-pipeline-actions--row">
                {selectedAction ? (
                  <button
                    type="button"
                    className="btn orders-advance-btn"
                    disabled={updatingId === selected.id}
                    onClick={() => void advanceStatus(selected)}
                  >
                    {updatingId === selected.id ? "Updating…" : selectedAction.label}
                    <ChevronRight size={16} />
                  </button>
                ) : null}
                {selected.status !== "cancelled" && selected.status !== "delivered" ? (
                  <button
                    type="button"
                    className="btn ghost orders-cancel-btn"
                    disabled={updatingId === selected.id}
                    onClick={() =>
                      void updateStatus(
                        selected.id,
                        "cancelled",
                        `${selected.order_number} cancelled`
                      )
                    }
                  >
                    <Ban size={14} />
                    Cancel
                  </button>
                ) : null}
              </div>
            </section>

            <div className="orders-desk-tabs">
              <button
                type="button"
                className={deskTab === "details" ? "is-active" : ""}
                onClick={() => setDeskTab("details")}
              >
                Details
              </button>
              <button
                type="button"
                className={deskTab === "invoice" ? "is-active" : ""}
                onClick={() => setDeskTab("invoice")}
              >
                Invoice
              </button>
              <button
                type="button"
                className={deskTab === "courier" ? "is-active" : ""}
                onClick={() => setDeskTab("courier")}
              >
                Courier
              </button>
            </div>

            <div className="orders-modal-body">
              {deskTab === "details" && (
                <div className="orders-modal-grid">
                  <section className="orders-info-card">
                    <header>
                      <UserRound size={15} />
                      <h4>Customer</h4>
                    </header>
                    <p>
                      <b>{selected.customer_name || "—"}</b>
                    </p>
                    <p className="muted">{selected.customer_email || "No email"}</p>
                    <p className="orders-info-phone">
                      <Phone size={13} />
                      {selected.customer_phone || "No phone"}
                    </p>
                  </section>

                  <section className="orders-info-card is-courier">
                    <header>
                      <MapPin size={15} />
                      <h4>Courier / deliver to</h4>
                    </header>
                    {selected.shipping_address ? (
                      <>
                        <p>
                          <b>{selected.shipping_address.recipient_name}</b>
                        </p>
                        <p className="orders-info-phone">
                          <Phone size={13} />
                          {selected.shipping_address.phone}
                        </p>
                        <p>{selected.shipping_address.line1}</p>
                        {selected.shipping_address.line2 ? (
                          <p>{selected.shipping_address.line2}</p>
                        ) : null}
                        <p>
                          {selected.shipping_address.city}, {selected.shipping_address.state}
                        </p>
                        <p className="orders-pin">PIN {selected.shipping_address.postal_code}</p>
                        <p className="muted">{selected.shipping_address.country}</p>
                      </>
                    ) : (
                      <AdminAlert>
                        No shipping address on this order. Confirm before dispatch.
                      </AdminAlert>
                    )}
                  </section>

                  <section className="orders-info-card orders-modal-span">
                    <header>
                      <Package size={15} />
                      <h4>Items ({itemCount})</h4>
                    </header>
                    <ul className="orders-item-list">
                      {selected.items.map((item, index) => (
                        <li key={`${item.product_id}-${index}`}>
                          <div>
                            <b>
                              {item.product_name}
                              {item.variant_name ? ` · ${item.variant_name}` : ""}
                            </b>
                            <span className="muted">
                              {item.sku || "—"} · Qty {item.quantity}
                            </span>
                          </div>
                          <strong>{formatMoney(item.line_total)}</strong>
                        </li>
                      ))}
                    </ul>
                    <div className="orders-mini-totals">
                      <div>
                        <span>Subtotal</span>
                        <b>{formatMoney(selected.subtotal)}</b>
                      </div>
                      <div>
                        <span>Discount</span>
                        <b>-{formatMoney(selected.discount_amount || 0)}</b>
                      </div>
                      <div>
                        <span>Shipping</span>
                        <b>{formatMoney(selected.shipping_amount)}</b>
                      </div>
                      <div className="is-total">
                        <span>Total</span>
                        <b>{formatMoney(selected.total_amount)}</b>
                      </div>
                    </div>
                  </section>

                  <section className="orders-info-card orders-modal-span">
                    <header>
                      <Truck size={15} />
                      <h4>Payment</h4>
                    </header>
                    <div className="orders-fulfill-row">
                      <AdminBadge tone={statusTone(selected.payment_status)}>
                        {selected.payment_status}
                      </AdminBadge>
                      <AdminBadge tone={statusTone(selected.status)}>
                        {statusLabel(selected.status)}
                      </AdminBadge>
                    </div>
                    {selected.payment ? (
                      <p className="muted">
                        Via {selected.payment.provider}
                        {selected.payment.provider_payment_id
                          ? ` · ${selected.payment.provider_payment_id}`
                          : ""}
                      </p>
                    ) : null}
                  </section>
                </div>
              )}

              {deskTab === "invoice" && (
                <div className="orders-invoice-wrap">
                  <div className="tvs-receipt-preview-label">Tax invoice · TVS LP 46</div>
                  <ThermalReceipt data={selected} id="online-invoice-print" />
                </div>
              )}

              {deskTab === "courier" && (
                <div className="orders-invoice-wrap">
                  <div className="tvs-receipt-preview-label">Courier label · TVS LP 46</div>
                  <CourierLabel
                    data={{
                      order_number: selected.order_number,
                      created_at: selected.created_at,
                      customer_name: selected.customer_name,
                      customer_phone: selected.customer_phone,
                      customer_email: selected.customer_email,
                      payment_status: selected.payment_status,
                      status: selected.status,
                      total_amount: selected.total_amount,
                      item_count: itemCount,
                      shipping_address: selected.shipping_address
                    }}
                    id="online-courier-print"
                  />
                </div>
              )}
            </div>

            <footer className="orders-modal-foot">
              <div className="orders-print-bar orders-print-bar--row">
                <button type="button" className="btn" onClick={() => printSlips("invoice")}>
                  <Printer size={14} />
                  Print invoice
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => printSlips("courier")}
                >
                  <Truck size={14} />
                  Print courier
                </button>
                <button type="button" className="btn" onClick={() => printSlips("both")}>
                  <Printer size={14} />
                  Print both
                </button>
              </div>
              <p className="tvs-print-hint muted">
                Printer: <b>TVS LP 46</b> · ~108 mm continuous · margins none · scale 100%.
              </p>
            </footer>

            <div className={`orders-print-stack is-mode-${printMode}`} aria-hidden="true">
              <ThermalReceipt data={selected} id="online-invoice-print-stack" />
              <div className="tvs-print-break" />
              <CourierLabel
                data={{
                  order_number: selected.order_number,
                  created_at: selected.created_at,
                  customer_name: selected.customer_name,
                  customer_phone: selected.customer_phone,
                  customer_email: selected.customer_email,
                  payment_status: selected.payment_status,
                  status: selected.status,
                  total_amount: selected.total_amount,
                  item_count: itemCount,
                  shipping_address: selected.shipping_address
                }}
                id="online-courier-print-stack"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
